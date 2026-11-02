import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  MAX_AUDIO_SPEED,
  MIN_AUDIO_DURATION_MS,
  MIN_AUDIO_SPEED,
  type AudioOperations,
} from "@editflow/shared";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";

export type SupportedAudioMimeType =
  | "audio/mpeg"
  | "audio/wav"
  | "audio/ogg"
  | "audio/mp4";

export interface AudioMetadata {
  mimeType: SupportedAudioMimeType;
  extension: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  byteSize: number;
}

export interface RenderedAudio {
  data: Buffer;
  mimeType: "audio/mpeg";
  extension: "mp3";
  durationMs: number;
  sampleRate: number;
  channels: number;
}

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
};

type ProbeOutput = {
  format?: {
    format_name?: string;
    duration?: string;
  };
  streams?: ProbeStream[];
};

const OUTPUT_SAMPLE_RATE = 44_100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_BITRATE = "192k";
const PROCESS_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 20_000;

const INVALID_AUDIO_MESSAGE =
  "Choose a valid MP3, WAV, OGG, or M4A audio file and try again.";

function run(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new AppError(500, "Audio processing timed out. Try a shorter clip."));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      // Keep only the tail so FFmpeg's banners cannot fill memory.
      stderr = `${stderr}${chunk.toString()}`.slice(-8_000);
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      console.error(`Could not start ${command}:`, error);
      reject(
        new AppError(
          500,
          "Audio processing is unavailable on this server. Install FFmpeg and FFprobe, or configure FFMPEG_PATH and FFPROBE_PATH.",
        ),
      );
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      console.error(`${command} failed with code ${code}: ${stderr}`);
      reject(
        new AppError(
          400,
          "The audio could not be processed with those settings.",
        ),
      );
    });
  });
}

async function probeFile(
  filePath: string,
): Promise<{ metadata: AudioMetadata; codecName: string | null }> {
  const { stdout } = await run(
    env.ffprobePath,
    [
      "-v",
      "error",
      "-show_entries",
      "format=format_name,duration:stream=codec_type,codec_name,sample_rate,channels,duration",
      "-of",
      "json",
      filePath,
    ],
    PROBE_TIMEOUT_MS,
  ).catch((error: unknown) => {
    if (error instanceof AppError && error.status >= 500) {
      throw error;
    }

    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  });

  let probe: ProbeOutput;

  try {
    probe = JSON.parse(stdout) as ProbeOutput;
  } catch {
    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  }

  const stream = probe.streams?.find(
    (candidate) => candidate.codec_type === "audio",
  );

  if (!stream) {
    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  }

  const formatName = probe.format?.format_name?.toLowerCase() ?? "";
  const formatDetails = formatForProbeName(formatName);

  if (!formatDetails) {
    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  }

  if (!codecMatchesContainer(formatDetails.extension, stream.codec_name)) {
    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  }

  const durationSeconds = Number(
    probe.format?.duration ?? stream.duration ?? "NaN",
  );
  const sampleRate = Number(stream.sample_rate ?? "0");
  const channels = Number(stream.channels ?? 0);

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isInteger(sampleRate) ||
    sampleRate <= 0 ||
    !Number.isInteger(channels) ||
    channels <= 0
  ) {
    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  }

  return {
    metadata: {
      mimeType: formatDetails.mimeType,
      extension: formatDetails.extension,
      durationMs: Math.round(durationSeconds * 1000),
      sampleRate,
      channels,
      byteSize: 0,
    },
    codecName: stream.codec_name ?? null,
  };
}

function formatForProbeName(formatName: string): {
  mimeType: SupportedAudioMimeType;
  extension: "mp3" | "wav" | "ogg" | "m4a";
} | null {
  if (formatName.split(",").some((name) => name === "mp3")) {
    return { mimeType: "audio/mpeg", extension: "mp3" };
  }

  if (formatName.split(",").some((name) => name === "wav")) {
    return { mimeType: "audio/wav", extension: "wav" };
  }

  if (formatName.split(",").some((name) => name === "ogg")) {
    return { mimeType: "audio/ogg", extension: "ogg" };
  }

  if (
    formatName
      .split(",")
      .some((name) => name === "mov" || name === "mp4" || name === "m4a")
  ) {
    return { mimeType: "audio/mp4", extension: "m4a" };
  }

  return null;
}

function codecMatchesContainer(
  extension: "mp3" | "wav" | "ogg" | "m4a",
  codecName: string | undefined,
): boolean {
  const codec = codecName?.toLowerCase() ?? "";

  switch (extension) {
    case "mp3":
      return codec === "mp3";
    case "wav":
      return codec.startsWith("pcm_");
    case "ogg":
      return codec === "vorbis" || codec === "opus";
    case "m4a":
      return codec === "aac";
  }
}

export async function inspectAudio(buffer: Buffer): Promise<AudioMetadata> {
  if (buffer.byteLength === 0) {
    throw new AppError(400, INVALID_AUDIO_MESSAGE, {
      audio: INVALID_AUDIO_MESSAGE,
    });
  }

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    const message = "The audio file must be 25 MB or smaller.";
    throw new AppError(413, message, { audio: message });
  }

  const directory = await mkdtemp(path.join(tmpdir(), "editflow-audio-probe-"));
  const inputPath = path.join(directory, "input");

  try {
    await writeFile(inputPath, buffer);
    const { metadata } = await probeFile(inputPath);

    if (metadata.durationMs < MIN_AUDIO_DURATION_MS) {
      const message = "The audio must be at least 0.5 seconds long.";
      throw new AppError(400, message, { audio: message });
    }

    if (metadata.durationMs > MAX_AUDIO_DURATION_MS) {
      const message = "The audio must be 10 minutes or shorter.";
      throw new AppError(400, message, { audio: message });
    }

    return { ...metadata, byteSize: buffer.byteLength };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function seconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(3);
}

function buildFilter(
  inputCount: number,
  operations: AudioOperations,
): string {
  const normalized = Array.from({ length: inputCount }, (_, index) => {
    return `[${index}:a]aformat=sample_rates=${OUTPUT_SAMPLE_RATE}:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`;
  });

  const parts = [...normalized];
  let sourceLabel: string;

  if (inputCount > 1) {
    const labels = Array.from({ length: inputCount }, (_, index) => `[a${index}]`);
    parts.push(
      `${labels.join("")}concat=n=${inputCount}:v=0:a=1[combined]`,
    );
    sourceLabel = "combined";
  } else {
    sourceLabel = "a0";
  }

  const { startMs, endMs } = operations.trim;
  const filters: string[] = [];

  if (startMs > 0 || endMs !== null) {
    filters.push(
      endMs === null
        ? `atrim=start=${seconds(startMs)}`
        : `atrim=start=${seconds(startMs)}:end=${seconds(endMs)}`,
    );
  }

  filters.push("asetpts=PTS-STARTPTS");

  if (Math.abs(operations.speed - 1) > 0.0001) {
    filters.push(`atempo=${operations.speed.toFixed(3)}`);
  }

  parts.push(`[${sourceLabel}]${filters.join(",")}[edited]`);
  return parts.join(";");
}

export async function renderEditedAudio(
  inputPaths: string[],
  operations: AudioOperations,
): Promise<RenderedAudio> {
  if (inputPaths.length === 0) {
    throw new AppError(400, "Choose at least one audio clip to process.");
  }

  if (
    operations.speed < MIN_AUDIO_SPEED ||
    operations.speed > MAX_AUDIO_SPEED
  ) {
    throw new AppError(
      400,
      `Playback speed must be between ${MIN_AUDIO_SPEED}× and ${MAX_AUDIO_SPEED}×.`,
    );
  }

  const directory = await mkdtemp(path.join(tmpdir(), "editflow-audio-render-"));
  const outputPath = path.join(directory, "edited.mp3");

  try {
    const args = ["-hide_banner", "-nostdin", "-y"];

    for (const inputPath of inputPaths) {
      args.push("-i", inputPath);
    }

    args.push(
      "-filter_complex",
      buildFilter(inputPaths.length, operations),
      "-map",
      "[edited]",
      "-vn",
      "-sn",
      "-dn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      OUTPUT_BITRATE,
      "-ar",
      String(OUTPUT_SAMPLE_RATE),
      "-ac",
      String(OUTPUT_CHANNELS),
      "-map_metadata",
      "-1",
      outputPath,
    );

    await run(env.ffmpegPath, args, PROCESS_TIMEOUT_MS);

    const data = await readFile(outputPath);
    const { metadata } = await probeFile(outputPath);

    if (metadata.durationMs < MIN_AUDIO_DURATION_MS - 50) {
      throw new AppError(
        400,
        "The edited audio would be shorter than 0.5 seconds. Adjust the trim.",
      );
    }

    if (metadata.durationMs > MAX_AUDIO_DURATION_MS) {
      throw new AppError(
        400,
        "The edited audio would be longer than 10 minutes. Shorten the trim or raise the speed.",
      );
    }

    return {
      data,
      mimeType: "audio/mpeg",
      extension: "mp3",
      durationMs: metadata.durationMs,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function extensionForAudioMimeType(mimeType: string): string {
  if (mimeType === "audio/wav") {
    return "wav";
  }

  if (mimeType === "audio/ogg") {
    return "ogg";
  }

  if (mimeType === "audio/mp4") {
    return "m4a";
  }

  return "mp3";
}

export function downloadFilename(name: string, extension: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return `${base || "editflow-audio"}.${extension}`;
}
