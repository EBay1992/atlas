import type {
  AuthClaims,
  DocumentRepository,
  IdGenerator,
  JobQueue,
  JobRepository,
  ObjectStore,
  PasswordHasher,
  TokenService,
  UserRepository,
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
  users: UserRepository;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  ids: IdGenerator;
  fakeProcessingMs: number;
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
