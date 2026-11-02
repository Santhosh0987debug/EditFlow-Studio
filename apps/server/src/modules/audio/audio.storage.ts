import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";

const storageRoot = path.resolve(env.audioStorageDir);

/**
 * Storage keys are relative POSIX paths created by this server. Resolve them
 * below the configured root and reject anything that could escape it.
 */
function resolveStorageKey(storageKey: string): string {
  const resolved = path.resolve(storageRoot, storageKey);
  const relative = path.relative(storageRoot, resolved);

  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new AppError(404, "Audio file not found.");
  }

  return resolved;
}

export function getAudioStorageRoot(): string {
  return storageRoot;
}

export async function saveAudioFile(
  projectId: string,
  assetId: string,
  data: Buffer,
  extension: string,
): Promise<{ storageKey: string; absolutePath: string }> {
  const storageKey = path.posix.join(
    projectId,
    assetId,
    `${randomUUID()}.${extension}`,
  );
  const absolutePath = resolveStorageKey(storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, data, { flag: "wx" });

  return { storageKey, absolutePath };
}

export async function readAudioFile(storageKey: string): Promise<Buffer> {
  try {
    return await readFile(resolveStorageKey(storageKey));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new AppError(404, "The stored audio file could not be found.");
    }

    throw error;
  }
}

export async function audioFilePath(storageKey: string): Promise<{
  absolutePath: string;
  byteSize: number;
}> {
  const absolutePath = resolveStorageKey(storageKey);

  try {
    const stats = await stat(absolutePath);
    return { absolutePath, byteSize: stats.size };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new AppError(404, "The stored audio file could not be found.");
    }

    throw error;
  }
}

export async function removeAudioFile(storageKey: string): Promise<void> {
  try {
    await unlink(resolveStorageKey(storageKey));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}
