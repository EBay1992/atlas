#!/usr/bin/env bash
set -euo pipefail

API_BASE="${ATLAS_API_URL:-http://127.0.0.1:3000}"

echo "Waiting for API at $API_BASE ..."
for i in $(seq 1 60); do
  if curl -sf "$API_BASE/health/live" >/dev/null; then
    break
  fi
  sleep 1
done

TOKEN=$(curl -sf -X POST "$API_BASE/v1/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"admin@acme.local","password":"atlas-dev-password"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [[ -z "$TOKEN" ]]; then
  echo "Login failed"
  exit 1
fi

# Prefer a repo-local temp file: mingw/Windows curl cannot read Git Bash /tmp paths.
TMP_DIR="${TMPDIR:-./.tmp}"
mkdir -p "$TMP_DIR"
TMP="$TMP_DIR/atlas-happy-path-$$.txt"
echo "atlas happy path $(date +%Y-%m-%dT%H:%M:%S%z)" >"$TMP"

UPLOAD=$(curl -sf -X POST "$API_BASE/v1/documents" \
  -H "authorization: Bearer $TOKEN" \
  -H "idempotency-key: script-$(date +%s)" \
  -F "file=@${TMP};type=text/plain;filename=hello.txt")

echo "$UPLOAD"
JOB_ID=$(echo "$UPLOAD" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')

for i in $(seq 1 60); do
  STATUS=$(curl -sf "$API_BASE/v1/jobs/$JOB_ID" -H "authorization: Bearer $TOKEN" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  echo "attempt $i status=$STATUS"
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then
    break
  fi
  sleep 1
done

curl -sf "$API_BASE/v1/jobs/$JOB_ID" -H "authorization: Bearer $TOKEN"
echo

echo "Searching..."
curl -sf -X POST "$API_BASE/v1/search" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"query":"atlas happy path","limit":5}'
echo
rm -f "$TMP"
