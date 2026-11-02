-- CreateEnum
CREATE TYPE "ImageVersionSource" AS ENUM ('original', 'edited');

-- CreateTable
CREATE TABLE "image_assets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_versions" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "ImageVersionSource" NOT NULL DEFAULT 'edited',
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "operations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "image_assets_project_id_updated_at_idx" ON "image_assets"("project_id", "updated_at");

-- CreateIndex
CREATE INDEX "image_versions_asset_id_created_at_idx" ON "image_versions"("asset_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "image_versions_asset_id_version_key" ON "image_versions"("asset_id", "version");

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_versions" ADD CONSTRAINT "image_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
