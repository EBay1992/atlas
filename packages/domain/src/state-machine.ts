import type { DocumentStatus, JobStatus } from "./types.js";

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["processing", "failed"],
  processing: ["completed", "failed"],
  completed: [],
  // Manual retry requeues a failed job as a new business action.
  failed: ["queued"],
};

const DOCUMENT_TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  uploaded: ["queued", "failed"],
  queued: ["processing", "failed"],
  processing: ["completed", "failed"],
  completed: [],
  failed: ["queued"],
};

export class IllegalStateTransitionError extends Error {
  constructor(
    public readonly entity: "job" | "document",
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Illegal ${entity} transition: ${from} → ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!JOB_TRANSITIONS[from].includes(to)) {
    throw new IllegalStateTransitionError("job", from, to);
  }
}

export function canJobTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function assertDocumentTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  if (!DOCUMENT_TRANSITIONS[from].includes(to)) {
    throw new IllegalStateTransitionError("document", from, to);
  }
}

export function canDocumentTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return DOCUMENT_TRANSITIONS[from].includes(to);
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === "completed" || status === "failed";
}
