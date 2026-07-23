-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "checksum_sha256" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "queue_job_id" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_status_idx" ON "documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ingestion_jobs_tenant_id_idx" ON "ingestion_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_document_id_idx" ON "ingestion_jobs"("document_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_tenant_id_status_idx" ON "ingestion_jobs"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_jobs_tenant_id_idempotency_key_key" ON "ingestion_jobs"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
