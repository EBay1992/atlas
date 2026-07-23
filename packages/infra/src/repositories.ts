import type {
  Chunk,
  CreateChunkInput,
  CreateDocumentInput,
  CreateJobInput,
  ChunkRepository,
  Document,
  DocumentRepository,
  DocumentStatus,
  IngestionJob,
  JobRepository,
  JobStatus,
  User,
  UserRepository,
  UserRole,
} from "@atlas/domain";
import type { PrismaClient } from "./generated/prisma/client.js";

function mapDocument(row: {
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
}): Document {
  return { ...row };
}

function mapJob(row: {
  id: string;
  tenantId: string;
  documentId: string;
  queueJobId: string | null;
  status: JobStatus;
  attemptCount: number;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IngestionJob {
  return { ...row };
}

function mapUser(row: {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return { ...row };
}

function mapChunk(row: {
  id: string;
  tenantId: string;
  documentId: string;
  ordinal: number;
  text: string;
  tokenEstimate: number;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}): Chunk {
  return { ...row };
}

export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateDocumentInput): Promise<Document> {
    const row = await this.prisma.document.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        byteSize: input.byteSize,
        storageKey: input.storageKey,
        status: input.status,
        checksumSha256: input.checksumSha256 ?? null,
      },
    });
    return mapDocument(row);
  }

  async findById(tenantId: string, id: string): Promise<Document | null> {
    const row = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    return row ? mapDocument(row) : null;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    from: DocumentStatus,
    to: DocumentStatus,
  ): Promise<Document | null> {
    const result = await this.prisma.document.updateMany({
      where: { id, tenantId, status: from },
      data: { status: to },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  }
}

export class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateJobInput): Promise<IngestionJob> {
    const row = await this.prisma.ingestionJob.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        documentId: input.documentId,
        status: input.status,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    return mapJob(row);
  }

  async findById(tenantId: string, id: string): Promise<IngestionJob | null> {
    const row = await this.prisma.ingestionJob.findFirst({
      where: { id, tenantId },
    });
    return row ? mapJob(row) : null;
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<IngestionJob | null> {
    const row = await this.prisma.ingestionJob.findFirst({
      where: { tenantId, idempotencyKey },
    });
    return row ? mapJob(row) : null;
  }

  async findByDocumentId(
    tenantId: string,
    documentId: string,
  ): Promise<IngestionJob[]> {
    const rows = await this.prisma.ingestionJob.findMany({
      where: { tenantId, documentId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapJob);
  }

  async updateStatus(
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
  ): Promise<IngestionJob | null> {
    const result = await this.prisma.ingestionJob.updateMany({
      where: { id, tenantId, status: from },
      data: {
        status: to,
        ...(patch?.queueJobId !== undefined
          ? { queueJobId: patch.queueJobId }
          : {}),
        ...(patch?.attemptCount !== undefined
          ? { attemptCount: patch.attemptCount }
          : {}),
        ...(patch?.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch?.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch?.completedAt !== undefined
          ? { completedAt: patch.completedAt }
          : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  }
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? mapUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }
}

export class PrismaChunkRepository implements ChunkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async replaceForDocument(
    tenantId: string,
    documentId: string,
    chunks: CreateChunkInput[],
  ): Promise<Chunk[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.chunk.deleteMany({ where: { tenantId, documentId } });
      if (chunks.length === 0) return [];
      await tx.chunk.createMany({
        data: chunks.map((c) => ({
          id: c.id,
          tenantId: c.tenantId,
          documentId: c.documentId,
          ordinal: c.ordinal,
          text: c.text,
          tokenEstimate: c.tokenEstimate,
          contentHash: c.contentHash,
        })),
      });
      const rows = await tx.chunk.findMany({
        where: { tenantId, documentId },
        orderBy: { ordinal: "asc" },
      });
      return rows.map(mapChunk);
    });
  }

  async deleteByDocumentId(
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    await this.prisma.chunk.deleteMany({ where: { tenantId, documentId } });
  }

  async findByIds(tenantId: string, ids: string[]): Promise<Chunk[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.chunk.findMany({
      where: { tenantId, id: { in: ids } },
    });
    return rows.map(mapChunk);
  }

  async findByDocumentId(
    tenantId: string,
    documentId: string,
  ): Promise<Chunk[]> {
    const rows = await this.prisma.chunk.findMany({
      where: { tenantId, documentId },
      orderBy: { ordinal: "asc" },
    });
    return rows.map(mapChunk);
  }
}
