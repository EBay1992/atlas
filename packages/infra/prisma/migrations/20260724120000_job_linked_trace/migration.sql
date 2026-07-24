-- AlterTable
ALTER TABLE "ingestion_jobs" ADD COLUMN "linked_traceparent" TEXT;
ALTER TABLE "ingestion_jobs" ADD COLUMN "linked_tracestate" TEXT;
