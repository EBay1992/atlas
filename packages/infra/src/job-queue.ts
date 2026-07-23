import type {
  EnqueueResult,
  IngestionJobPayload,
  JobQueue,
} from "@atlas/domain";
import { Queue, type ConnectionOptions } from "bullmq";

export interface BullMqJobQueueOptions {
  connection: ConnectionOptions;
  queueName: string;
  attempts?: number;
}

export class BullMqJobQueue implements JobQueue {
  private readonly queue: Queue<IngestionJobPayload>;
  private readonly attempts: number;

  constructor(options: BullMqJobQueueOptions) {
    this.attempts = options.attempts ?? 5;
    this.queue = new Queue<IngestionJobPayload>(options.queueName, {
      connection: options.connection,
      defaultJobOptions: {
        attempts: this.attempts,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async enqueueIngestion(payload: IngestionJobPayload): Promise<EnqueueResult> {
    const job = await this.queue.add("process-document", payload, {
      jobId: payload.jobId,
    });
    return { queueJobId: String(job.id) };
  }

  async ping(): Promise<void> {
    await this.queue.waitUntilReady();
  }

  async getWaitingCount(): Promise<number> {
    return this.queue.getWaitingCount();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export function createRedisConnection(options: {
  host: string;
  port: number;
  password?: string;
}): ConnectionOptions {
  return {
    host: options.host,
    port: options.port,
    ...(options.password ? { password: options.password } : {}),
    maxRetriesPerRequest: null,
  };
}
