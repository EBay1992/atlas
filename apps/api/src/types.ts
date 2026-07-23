import type {
  AuthClaims,
  ChunkRepository,
  DocumentRepository,
  EmbeddingProvider,
  IdGenerator,
  JobQueue,
  JobRepository,
  ObjectStore,
  PasswordHasher,
  TokenService,
  UserRepository,
  VectorStore,
} from "@atlas/domain";
import type { AtlasMetrics, Logger } from "@atlas/observability";
import type { PrismaClient } from "@atlas/infra";

export interface AppDeps {
  prisma: PrismaClient;
  logger: Logger;
  metrics: AtlasMetrics;
  objectStore: ObjectStore;
  jobQueue: JobQueue;
  documents: DocumentRepository;
  jobs: JobRepository;
  chunks: ChunkRepository;
  users: UserRepository;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  ids: IdGenerator;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }

  interface FastifyRequest {
    auth?: AuthClaims;
    requestId: string;
    correlationId: string;
  }
}
