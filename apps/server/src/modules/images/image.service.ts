import { randomUUID } from "node:crypto";
import type {
  ImageAssetDto,
  ImageAssetSummaryDto,
  ImageOperations,
  ImageVersionDto,
  ImageVersionSource,
} from "@editflow/shared";
import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/app-error";
import { prisma } from "../../lib/prisma";
import { getOwnedProject } from "../projects/project.service";
import type { ImageOperationsInput } from "./image.schemas";
import { imageOperationsSchema } from "./image.schemas";
import {
  downloadFilename,
  extensionForMimeType,
  inspectImage,
  renderEditedImage,
  renderImagePreview,
  type RenderedImage,
} from "./image.processor";
import {
  readImageFile,
  removeImageFile,
  saveImageFile,
} from "./image.storage";

type ImageVersionRecord = {
  id: string;
  version: number;
  source: ImageVersionSource;
  storageKey: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  operations: Prisma.JsonValue | null;
  createdAt: Date;
};

type ImageAssetRecord = {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: Date;
  updatedAt: Date;
};

const versionSelect = {
  id: true,
  version: true,
  source: true,
  storageKey: true,
  mimeType: true,
  width: true,
  height: true,
  byteSize: true,
  operations: true,
  createdAt: true,
} as const;

const assetSelect = {
  id: true,
  projectId: true,
  name: true,
  originalFilename: true,
  mimeType: true,
  width: true,
  height: true,
  byteSize: true,
  createdAt: true,
  updatedAt: true,
} as const;

const assetWithVersionsSelect = {
  ...assetSelect,
  versions: {
    orderBy: { version: "desc" as const },
    select: versionSelect,
  },
} as const;

function parseStoredOperations(value: Prisma.JsonValue | null): ImageOperations | null {
  if (value === null) {
    return null;
  }

  const result = imageOperationsSchema.safeParse(value);
  return result.success ? result.data : null;
}

function toVersionDto(version: ImageVersionRecord): ImageVersionDto {
  return {
    id: version.id,
    version: version.version,
    source: version.source,
    mimeType: version.mimeType,
    width: version.width,
    height: version.height,
    byteSize: version.byteSize,
    operations: parseStoredOperations(version.operations),
    createdAt: version.createdAt.toISOString(),
  };
}

function sortVersions(
  versions: ImageVersionRecord[],
): ImageVersionRecord[] {
  return [...versions].sort((a, b) => b.version - a.version);
}

function toAssetSummary(
  asset: ImageAssetRecord,
  versions: ImageVersionRecord[],
): ImageAssetSummaryDto {
  const sorted = sortVersions(versions);

  return {
    id: asset.id,
    projectId: asset.projectId,
    name: asset.name,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    versionCount: sorted.length,
    latestVersion: sorted[0] ? toVersionDto(sorted[0]) : null,
  };
}

function toAssetDto(
  asset: ImageAssetRecord,
  versions: ImageVersionRecord[],
): ImageAssetDto {
  const sorted = sortVersions(versions);
  const original = sorted.find((version) => version.version === 1) ?? null;

  return {
    ...toAssetSummary(asset, sorted),
    originalVersion: original ? toVersionDto(original) : null,
    versions: sorted.map(toVersionDto),
  };
}

function displayName(originalFilename: string): string {
  const base = originalFilename.replace(/\.[^.]+$/, "").trim();
  return (base || "Untitled image").slice(0, 120);
}

async function getAssetWithVersions(
  ownerId: string,
  projectId: string,
  imageId: string,
): Promise<{ asset: ImageAssetRecord; versions: ImageVersionRecord[] }> {
  await getOwnedProject(ownerId, projectId);

  const asset = await prisma.imageAsset.findFirst({
    where: { id: imageId, projectId },
    select: assetWithVersionsSelect,
  });

  if (!asset) {
    throw new AppError(404, "Image not found.");
  }

  return {
    asset,
    versions: sortVersions(asset.versions),
  };
}

function findOriginalVersion(
  versions: ImageVersionRecord[],
): ImageVersionRecord {
  const original = versions.find((version) => version.version === 1);

  if (!original) {
    throw new AppError(404, "The original image could not be found.");
  }

  return original;
}

export async function listImageAssets(
  ownerId: string,
  projectId: string,
): Promise<ImageAssetSummaryDto[]> {
  await getOwnedProject(ownerId, projectId);

  const assets = await prisma.imageAsset.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    select: assetWithVersionsSelect,
  });

  return assets.map((asset) => toAssetSummary(asset, asset.versions));
}

export async function getImageAsset(
  ownerId: string,
  projectId: string,
  imageId: string,
): Promise<ImageAssetDto> {
  const { asset, versions } = await getAssetWithVersions(
    ownerId,
    projectId,
    imageId,
  );

  return toAssetDto(asset, versions);
}

export async function uploadImage(
  ownerId: string,
  projectId: string,
  file: { buffer: Buffer; originalname: string },
): Promise<ImageAssetDto> {
  await getOwnedProject(ownerId, projectId);

  const metadata = await inspectImage(file.buffer);
  const assetId = randomUUID();
  const stored = await saveImageFile(
    projectId,
    assetId,
    file.buffer,
    metadata.extension,
  );

  try {
    const asset = await prisma.imageAsset.create({
      data: {
        id: assetId,
        projectId,
        name: displayName(file.originalname),
        originalFilename: file.originalname.slice(0, 255),
        mimeType: metadata.mimeType,
        width: metadata.width,
        height: metadata.height,
        byteSize: metadata.byteSize,
      },
      select: assetSelect,
    });

    const version = await prisma.imageVersion.create({
      data: {
        assetId,
        version: 1,
        source: "original",
        storageKey: stored.storageKey,
        mimeType: metadata.mimeType,
        width: metadata.width,
        height: metadata.height,
        byteSize: metadata.byteSize,
      },
      select: versionSelect,
    });

    return toAssetDto(asset, [version]);
  } catch (error) {
    await removeImageFile(stored.storageKey).catch(() => undefined);
    await prisma.imageAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    throw error;
  }
}

export async function renderAssetPreview(
  ownerId: string,
  projectId: string,
  imageId: string,
  operations: ImageOperationsInput,
): Promise<RenderedImage> {
  const { versions } = await getAssetWithVersions(ownerId, projectId, imageId);
  const original = findOriginalVersion(versions);
  const buffer = await readImageFile(original.storageKey);

  return renderImagePreview(buffer, operations);
}

export async function saveImageVersion(
  ownerId: string,
  projectId: string,
  imageId: string,
  operations: ImageOperationsInput,
): Promise<ImageVersionDto> {
  const { versions } = await getAssetWithVersions(ownerId, projectId, imageId);
  const original = findOriginalVersion(versions);
  const latestVersion = versions[0]?.version ?? 0;
  const buffer = await readImageFile(original.storageKey);
  const rendered = await renderEditedImage(
    buffer,
    operations,
    original.mimeType,
  );
  const stored = await saveImageFile(
    projectId,
    imageId,
    rendered.data,
    rendered.extension,
  );

  try {
    const version = await prisma.imageVersion.create({
      data: {
        assetId: imageId,
        version: latestVersion + 1,
        source: "edited",
        storageKey: stored.storageKey,
        mimeType: rendered.mimeType,
        width: rendered.width,
        height: rendered.height,
        byteSize: rendered.data.byteLength,
        operations: operations as Prisma.InputJsonValue,
      },
      select: versionSelect,
    });

    await prisma.imageAsset.update({
      where: { id: imageId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return toVersionDto(version);
  } catch (error) {
    await removeImageFile(stored.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function exportEditedImage(
  ownerId: string,
  projectId: string,
  imageId: string,
  operations: ImageOperationsInput,
): Promise<RenderedImage & { filename: string }> {
  const { asset, versions } = await getAssetWithVersions(
    ownerId,
    projectId,
    imageId,
  );
  const original = findOriginalVersion(versions);
  const buffer = await readImageFile(original.storageKey);
  const rendered = await renderEditedImage(
    buffer,
    operations,
    original.mimeType,
  );

  return {
    ...rendered,
    filename: downloadFilename(asset.name, rendered.extension),
  };
}

export async function getImageFile(
  ownerId: string,
  projectId: string,
  imageId: string,
  versionId?: string,
): Promise<{
  data: Buffer;
  mimeType: string;
  filename: string;
}> {
  const { asset, versions } = await getAssetWithVersions(
    ownerId,
    projectId,
    imageId,
  );
  const version = versionId
    ? versions.find((candidate) => candidate.id === versionId)
    : versions.find((candidate) => candidate.version === 1);

  if (!version) {
    throw new AppError(404, "Image version not found.");
  }

  const data = await readImageFile(version.storageKey);
  const suffix = version.version === 1 ? "original" : `v${version.version}`;

  return {
    data,
    mimeType: version.mimeType,
    filename: downloadFilename(
      `${asset.name}-${suffix}`,
      extensionForMimeType(version.mimeType),
    ),
  };
}
