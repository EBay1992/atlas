import type { Readable } from "node:stream";
import type {
  Document,
  DocumentStatus,
  IngestionJob,
  JobStatus,
  User,
} from "./types.js";

export interface ObjectPutInput {
  key: string;
  body: Readable | Buffer;
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface ObjectStore {
  putObject(input: ObjectPutInput): Promise<void>;
  headObject(key: string): Promise<{ contentLength: number; contentType?: string }>;
  getObject(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  ensureBucket(): Promise<void>;
  ping(): Promise<void>;
}

export interface CreateDocumentInput {
  id: string;
  tenantId: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  status: DocumentStatus;
  checksumSha256?: string | null;
}

export interface CreateJobInput {
  id: string;
  tenantId: string;
  documentId: string;
  status: JobStatus;
  idempotencyKey?: string | null;
}

export interface DocumentRepository {
  create(input: CreateDocumentInput): Promise<Document>;
  findById(tenantId: string, id: string): Promise<Document | null>;
  updateStatus(
    tenantId: string,
    id: string,
    from: DocumentStatus,
    to: DocumentStatus,
  ): Promise<Document | null>;
}

export interface JobRepository {
  create(input: CreateJobInput): Promise<IngestionJob>;
  findById(tenantId: string, id: string): Promise<IngestionJob | null>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<IngestionJob | null>;
  findByDocumentId(tenantId: string, documentId: string): Promise<IngestionJob[]>;
  updateStatus(
    tenantId: string,
    id: string,
    from: JobStatus,
    to: JobStatus,
    patch?: {
      queueJobId?: string | null;
      attemptCount?: number;
      lastError?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
  ): Promise<IngestionJob | null>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export interface IngestionJobPayload {
  jobId: string;
  documentId: string;
  tenantId: string;
  storageKey: string;
  traceparent?: string;
}

export interface EnqueueResult {
  queueJobId: string;
}

export interface JobQueue {
  enqueueIngestion(payload: IngestionJobPayload): Promise<EnqueueResult>;
  ping(): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface TokenService {
  sign(claims: {
    sub: string;
    tenantId: string;
    email: string;
    role: string;
  }): Promise<string>;
  verify(token: string): Promise<{
    sub: string;
    tenantId: string;
    email: string;
    role: string;
  }>;
}
