-- CreateEnum
CREATE TYPE "AudioVersionSource" AS ENUM ('original', 'edited');

-- CreateTable
CREATE TABLE "audio_assets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "sample_rate" INTEGER NOT NULL,
    "channels" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_versions" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "AudioVersionSource" NOT NULL DEFAULT 'edited',
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "sample_rate" INTEGER NOT NULL,
    "channels" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "operations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audio_assets_project_id_updated_at_idx" ON "audio_assets"("project_id", "updated_at");

-- CreateIndex
CREATE INDEX "audio_versions_asset_id_created_at_idx" ON "audio_versions"("asset_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "audio_versions_asset_id_version_key" ON "audio_versions"("asset_id", "version");

-- AddForeignKey
ALTER TABLE "audio_assets" ADD CONSTRAINT "audio_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_versions" ADD CONSTRAINT "audio_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "audio_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
