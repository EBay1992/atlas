#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${ATLAS_API_URL:-http://127.0.0.1:3000}"
DOCS_DIR="${ROOT}/fixtures/seed-docs"
# Stable idempotency prefix so re-runs reuse the same documents
SEED_TAG="${ATLAS_SEED_TAG:-polysemy-v1}"

echo "Waiting for API at $API_BASE ..."
for _ in $(seq 1 60); do
  if curl -sf "$API_BASE/health/live" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -sf "$API_BASE/health/live" >/dev/null; then
  echo "API not reachable at $API_BASE"
  exit 1
fi

TOKEN=$(curl -sf -X POST "$API_BASE/v1/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"admin@acme.local","password":"atlas-dev-password"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [[ -z "$TOKEN" ]]; then
  echo "Login failed"
  exit 1
fi

echo "Uploading polysemy seed documents (tag=$SEED_TAG)..."
JOB_IDS=()

shopt -s nullglob
FILES=("$DOCS_DIR"/[0-9][0-9]-*.txt)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No seed docs found in $DOCS_DIR"
  exit 1
fi

for FILE in "${FILES[@]}"; do
  NAME="$(basename "$FILE")"
  KEY="${SEED_TAG}:${NAME}"
  RESP=$(curl -sf -X POST "$API_BASE/v1/documents" \
    -H "authorization: Bearer $TOKEN" \
    -H "idempotency-key: ${KEY}" \
    -F "file=@${FILE};type=text/plain;filename=${NAME}")
  JOB_ID=$(echo "$RESP" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')
  DOC_ID=$(echo "$RESP" | sed -n 's/.*"documentId":"\([^"]*\)".*/\1/p')
  REUSED=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reused'))" 2>/dev/null || echo "?")
  echo "  $NAME  documentId=$DOC_ID  jobId=$JOB_ID  reused=${REUSED:-?}"
  JOB_IDS+=("$JOB_ID")
done

echo
echo "Waiting for ingestion jobs..."
FAILED=0
for JOB_ID in "${JOB_IDS[@]}"; do
  STATUS="queued"
  for _ in $(seq 1 120); do
    STATUS=$(curl -sf "$API_BASE/v1/jobs/$JOB_ID" -H "authorization: Bearer $TOKEN" \
      | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
    if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then
      break
    fi
    sleep 1
  done
  echo "  job $JOB_ID -> $STATUS"
  if [[ "$STATUS" != "completed" ]]; then
    FAILED=1
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "One or more jobs did not complete"
  exit 1
fi

echo
echo "Try sense-disambiguating searches, e.g.:"
echo "  curl -s -X POST $API_BASE/v1/search -H \"authorization: Bearer \$TOKEN\" \\"
echo "    -H 'content-type: application/json' \\"
echo "    -d '{\"query\":\"heirloom cider orchard tannin\",\"limit\":3}' | jq"
echo
echo "  curl -s -X POST $API_BASE/v1/search -H \"authorization: Bearer \$TOKEN\" \\"
echo "    -H 'content-type: application/json' \\"
echo "    -d '{\"query\":\"Cupertino App Store silicon wafer\",\"limit\":3}' | jq"
echo
echo "Ambiguous single-word queries (apple / java / bank / crane / mercury) should mix senses."
echo "See fixtures/seed-docs/README.md for the full query list."
