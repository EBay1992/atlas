-- CreateTable
CREATE TABLE "chunks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "token_estimate" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chunks_tenant_id_idx" ON "chunks"("tenant_id");

-- CreateIndex
CREATE INDEX "chunks_tenant_id_document_id_idx" ON "chunks"("tenant_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "chunks_document_id_ordinal_key" ON "chunks"("document_id", "ordinal");

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
