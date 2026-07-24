export type UserRole = "admin" | "member";

export type DocumentStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  tenantId: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  status: DocumentStatus;
  checksumSha256: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngestionJob {
  id: string;
  tenantId: string;
  documentId: string;
  queueJobId: string | null;
  status: JobStatus;
  attemptCount: number;
  lastError: string | null;
  /** Original W3C traceparent from the upload (for manual retry span links). */
  linkedTraceparent: string | null;
  linkedTracestate: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthClaims {
  sub: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

export interface Chunk {
  id: string;
  tenantId: string;
  documentId: string;
  ordinal: number;
  text: string;
  tokenEstimate: number;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}
