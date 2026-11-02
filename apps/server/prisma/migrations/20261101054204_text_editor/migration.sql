-- CreateEnum
CREATE TYPE "TextVersionSource" AS ENUM ('manual', 'ai_accepted', 'restored');

-- CreateTable
CREATE TABLE "text_documents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "TextVersionSource" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "text_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "text_documents_project_id_key" ON "text_documents"("project_id");

-- CreateIndex
CREATE INDEX "text_versions_document_id_created_at_idx" ON "text_versions"("document_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "text_versions_document_id_version_key" ON "text_versions"("document_id", "version");

-- AddForeignKey
ALTER TABLE "text_documents" ADD CONSTRAINT "text_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_versions" ADD CONSTRAINT "text_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "text_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
