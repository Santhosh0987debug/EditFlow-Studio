import { randomUUID } from "node:crypto";
import type {
  AudioAssetDto,
  AudioAssetSummaryDto,
  AudioOperations,
  AudioVersionDto,
  AudioVersionSource,
} from "@editflow/shared";
import {
  MAX_AUDIO_DURATION_MS,
  MIN_AUDIO_DURATION_MS,
} from "@editflow/shared";
import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/app-error";
import { prisma } from "../../lib/prisma";
import { getOwnedProject } from "../projects/project.service";
import type { AudioOperationsInput } from "./audio.schemas";
import { audioOperationsSchema } from "./audio.schemas";
import {
  downloadFilename,
  extensionForAudioMimeType,
  inspectAudio,
  renderEditedAudio,
  type RenderedAudio,
} from "./audio.processor";
import {
  audioFilePath,
  removeAudioFile,
  saveAudioFile,
} from "./audio.storage";

type AudioVersionRecord = {
  id: string;
  version: number;
  source: AudioVersionSource;
  storageKey: string;
  mimeType: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  byteSize: number;
  operations: Prisma.JsonValue | null;
  createdAt: Date;
};

type AudioAssetRecord = {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
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
  durationMs: true,
  sampleRate: true,
  channels: true,
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
  durationMs: true,
  sampleRate: true,
  channels: true,
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

function parseStoredOperations(
  value: Prisma.JsonValue | null,
): AudioOperations | null {
  if (value === null) {
    return null;
  }

  const result = audioOperationsSchema.safeParse(value);
  return result.success ? result.data : null;
}

function toVersionDto(version: AudioVersionRecord): AudioVersionDto {
  return {
    id: version.id,
    version: version.version,
    source: version.source,
    mimeType: version.mimeType,
    durationMs: version.durationMs,
    sampleRate: version.sampleRate,
    channels: version.channels,
    byteSize: version.byteSize,
    operations: parseStoredOperations(version.operations),
    createdAt: version.createdAt.toISOString(),
  };
}

function sortVersions(
  versions: AudioVersionRecord[],
): AudioVersionRecord[] {
  return [...versions].sort((a, b) => b.version - a.version);
}

function toAssetSummary(
  asset: AudioAssetRecord,
  versions: AudioVersionRecord[],
): AudioAssetSummaryDto {
  const sorted = sortVersions(versions);

  return {
    id: asset.id,
    projectId: asset.projectId,
    name: asset.name,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    durationMs: asset.durationMs,
    sampleRate: asset.sampleRate,
    channels: asset.channels,
    byteSize: asset.byteSize,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    versionCount: sorted.length,
    latestVersion: sorted[0] ? toVersionDto(sorted[0]) : null,
  };
}

function toAssetDto(
  asset: AudioAssetRecord,
  versions: AudioVersionRecord[],
): AudioAssetDto {
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
  return (base || "Untitled audio").slice(0, 120);
}

async function getAssetWithVersions(
  ownerId: string,
  projectId: string,
  audioId: string,
): Promise<{ asset: AudioAssetRecord; versions: AudioVersionRecord[] }> {
  await getOwnedProject(ownerId, projectId);

  const asset = await prisma.audioAsset.findFirst({
    where: { id: audioId, projectId },
    select: assetWithVersionsSelect,
  });

  if (!asset) {
    throw new AppError(404, "Audio clip not found.");
  }

  return {
    asset,
    versions: sortVersions(asset.versions),
  };
}

function findOriginalVersion(
  versions: AudioVersionRecord[],
): AudioVersionRecord {
  const original = versions.find((version) => version.version === 1);

  if (!original) {
    throw new AppError(404, "The original audio could not be found.");
  }

  return original;
}

export async function listAudioAssets(
  ownerId: string,
  projectId: string,
): Promise<AudioAssetSummaryDto[]> {
  await getOwnedProject(ownerId, projectId);

  const assets = await prisma.audioAsset.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    select: assetWithVersionsSelect,
  });

  return assets.map((asset) => toAssetSummary(asset, asset.versions));
}

export async function getAudioAsset(
  ownerId: string,
  projectId: string,
  audioId: string,
): Promise<AudioAssetDto> {
  const { asset, versions } = await getAssetWithVersions(
    ownerId,
    projectId,
    audioId,
  );

  return toAssetDto(asset, versions);
}

export async function uploadAudio(
  ownerId: string,
  projectId: string,
  file: { buffer: Buffer; originalname: string },
): Promise<AudioAssetDto> {
  await getOwnedProject(ownerId, projectId);

  const metadata = await inspectAudio(file.buffer);
  const assetId = randomUUID();
  const stored = await saveAudioFile(
    projectId,
    assetId,
    file.buffer,
    metadata.extension,
  );

  try {
    const asset = await prisma.audioAsset.create({
      data: {
        id: assetId,
        projectId,
        name: displayName(file.originalname),
        originalFilename: file.originalname.slice(0, 255),
        mimeType: metadata.mimeType,
        durationMs: metadata.durationMs,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
        byteSize: metadata.byteSize,
      },
      select: assetSelect,
    });

    const version = await prisma.audioVersion.create({
      data: {
        assetId,
        version: 1,
        source: "original",
        storageKey: stored.storageKey,
        mimeType: metadata.mimeType,
        durationMs: metadata.durationMs,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
        byteSize: metadata.byteSize,
      },
      select: versionSelect,
    });

    return toAssetDto(asset, [version]);
  } catch (error) {
    await removeAudioFile(stored.storageKey).catch(() => undefined);
    await prisma.audioAsset
      .delete({ where: { id: assetId } })
      .catch(() => undefined);
    throw error;
  }
}

async function resolveSourcePaths(
  ownerId: string,
  projectId: string,
  audioId: string,
  operations: AudioOperationsInput,
): Promise<{
  asset: AudioAssetRecord;
  versions: AudioVersionRecord[];
  inputPaths: string[];
  mergedDurationMs: number;
}> {
  const { asset, versions } = await getAssetWithVersions(
    ownerId,
    projectId,
    audioId,
  );

  if (operations.mergeAssetIds.includes(audioId)) {
    throw new AppError(
      400,
      "The current clip is already first in the merge. Choose other clips.",
      { operations: "A clip can only appear once in a merge." },
    );
  }

  const mergeAssets =
    operations.mergeAssetIds.length > 0
      ? await prisma.audioAsset.findMany({
          where: {
            id: { in: operations.mergeAssetIds },
            projectId,
          },
          select: assetWithVersionsSelect,
        })
      : [];

  const byId = new Map(mergeAssets.map((candidate) => [candidate.id, candidate]));
  const orderedSources = [
    { asset, versions },
    ...operations.mergeAssetIds.map((mergeId) => {
      const candidate = byId.get(mergeId);

      if (!candidate) {
        throw new AppError(
          400,
          "One of the selected clips for merging is no longer available.",
          { operations: "Choose the merged clips again." },
        );
      }

      return {
        asset: candidate,
        versions: sortVersions(candidate.versions),
      };
    }),
  ];

  const mergedDurationMs = orderedSources.reduce(
    (total, source) => total + source.asset.durationMs,
    0,
  );

  if (mergedDurationMs > MAX_AUDIO_DURATION_MS) {
    throw new AppError(
      400,
      "The merged clips are longer than the 10 minute limit. Remove a clip or choose shorter audio.",
      { operations: "Merged audio must be 10 minutes or shorter." },
    );
  }

  const endMs = operations.trim.endMs ?? mergedDurationMs;

  if (operations.trim.startMs >= mergedDurationMs) {
    throw new AppError(400, "Trim start must be inside the audio timeline.", {
      operations: "Move the trim start earlier.",
    });
  }

  if (operations.trim.endMs !== null && operations.trim.endMs > mergedDurationMs) {
    throw new AppError(400, "Trim end must be inside the audio timeline.", {
      operations: "Move the trim end earlier.",
    });
  }

  const trimmedDurationMs = endMs - operations.trim.startMs;
  const outputDurationMs = trimmedDurationMs / operations.speed;

  if (outputDurationMs < MIN_AUDIO_DURATION_MS) {
    throw new AppError(
      400,
      "The edited audio would be shorter than 0.5 seconds. Extend the trim or lower the speed.",
      { operations: "The edited audio must be at least 0.5 seconds long." },
    );
  }

  if (outputDurationMs > MAX_AUDIO_DURATION_MS) {
    throw new AppError(
      400,
      "The edited audio would be longer than 10 minutes. Shorten the trim or raise the speed.",
      { operations: "The edited audio must be 10 minutes or shorter." },
    );
  }

  const paths = orderedSources.map((source) => {
    const sourceOriginal = findOriginalVersion(source.versions);
    return sourceOriginal.storageKey;
  });

  // Resolve storage keys one failure at a time so missing files still produce
  // the same authenticated 404 response as image delivery.
  const inputPaths: string[] = [];

  for (const storageKey of paths) {
    const file = await audioFilePath(storageKey);
    inputPaths.push(file.absolutePath);
  }

  return { asset, versions, inputPaths, mergedDurationMs };
}

export async function renderAssetPreview(
  ownerId: string,
  projectId: string,
  audioId: string,
  operations: AudioOperationsInput,
): Promise<RenderedAudio> {
  const { inputPaths } = await resolveSourcePaths(
    ownerId,
    projectId,
    audioId,
    operations,
  );

  return renderEditedAudio(inputPaths, operations);
}

export async function saveAudioVersion(
  ownerId: string,
  projectId: string,
  audioId: string,
  operations: AudioOperationsInput,
): Promise<AudioVersionDto> {
  const { asset, versions, inputPaths } = await resolveSourcePaths(
    ownerId,
    projectId,
    audioId,
    operations,
  );
  const rendered = await renderEditedAudio(inputPaths, operations);
  const latestVersion = versions[0]?.version ?? 0;
  const stored = await saveAudioFile(
    projectId,
    audioId,
    rendered.data,
    rendered.extension,
  );

  try {
    const version = await prisma.audioVersion.create({
      data: {
        assetId: audioId,
        version: latestVersion + 1,
        source: "edited",
        storageKey: stored.storageKey,
        mimeType: rendered.mimeType,
        durationMs: rendered.durationMs,
        sampleRate: rendered.sampleRate,
        channels: rendered.channels,
        byteSize: rendered.data.byteLength,
        operations: operations as Prisma.InputJsonValue,
      },
      select: versionSelect,
    });

    await prisma.audioAsset.update({
      where: { id: audioId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return toVersionDto(version);
  } catch (error) {
    await removeAudioFile(stored.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function exportEditedAudio(
  ownerId: string,
  projectId: string,
  audioId: string,
  operations: AudioOperationsInput,
): Promise<RenderedAudio & { filename: string }> {
  const { asset, inputPaths } = await resolveSourcePaths(
    ownerId,
    projectId,
    audioId,
    operations,
  );
  const rendered = await renderEditedAudio(inputPaths, operations);

  return {
    ...rendered,
    filename: downloadFilename(asset.name, rendered.extension),
  };
}

export async function getAudioFile(
  ownerId: string,
  projectId: string,
  audioId: string,
  versionId?: string,
): Promise<{
  absolutePath: string;
  byteSize: number;
  mimeType: string;
  filename: string;
}> {
  const { asset, versions } = await getAssetWithVersions(
    ownerId,
    projectId,
    audioId,
  );
  const version = versionId
    ? versions.find((candidate) => candidate.id === versionId)
    : versions.find((candidate) => candidate.version === 1);

  if (!version) {
    throw new AppError(404, "Audio version not found.");
  }

  const stored = await audioFilePath(version.storageKey);
  const suffix = version.version === 1 ? "original" : `v${version.version}`;

  return {
    ...stored,
    mimeType: version.mimeType,
    filename: downloadFilename(
      `${asset.name}-${suffix}`,
      extensionForAudioMimeType(version.mimeType),
    ),
  };
}
