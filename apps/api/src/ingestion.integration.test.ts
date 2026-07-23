import { describe, expect, it } from "vitest";
import { waitFor } from "@atlas/test-utils";

const API_BASE = process.env.ATLAS_API_URL ?? "http://127.0.0.1:3000";

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@acme.local",
      password: "atlas-dev-password",
    }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

describe("ingestion happy path", () => {
  it(
    "uploads a document, enqueues a job, and reaches completed",
    async () => {
      const live = await fetch(`${API_BASE}/health/live`);
      if (!live.ok) {
        throw new Error(
          `API not reachable at ${API_BASE}. Start infra + api + worker first.`,
        );
      }

      const token = await login();
      const idempotencyKey = `test-${Date.now()}`;
      const form = new FormData();
      form.append(
        "file",
        new Blob(["hello atlas knowledge platform"], { type: "text/plain" }),
        "hello.txt",
      );

      const upload = await fetch(`${API_BASE}/v1/documents`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: form,
      });
      expect(upload.status).toBe(202);
      const uploaded = (await upload.json()) as {
        documentId: string;
        jobId: string;
        status: string;
        reused: boolean;
      };
      expect(uploaded.reused).toBe(false);
      expect(uploaded.status).toBe("queued");

      const replay = await fetch(`${API_BASE}/v1/documents`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: form,
      });
      expect(replay.status).toBe(202);
      const replayed = (await replay.json()) as {
        documentId: string;
        jobId: string;
        reused: boolean;
      };
      expect(replayed.reused).toBe(true);
      expect(replayed.documentId).toBe(uploaded.documentId);
      expect(replayed.jobId).toBe(uploaded.jobId);

      const completed = await waitFor(
        async () => {
          const res = await fetch(`${API_BASE}/v1/jobs/${uploaded.jobId}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;
          const job = (await res.json()) as { status: string };
          return job.status === "completed" ? job : null;
        },
        { timeoutMs: 30_000, intervalMs: 500 },
      );
      expect(completed.status).toBe("completed");

      const docRes = await fetch(
        `${API_BASE}/v1/documents/${uploaded.documentId}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(docRes.status).toBe(200);
      const doc = (await docRes.json()) as { status: string };
      expect(doc.status).toBe("completed");
    },
    60_000,
  );
});
