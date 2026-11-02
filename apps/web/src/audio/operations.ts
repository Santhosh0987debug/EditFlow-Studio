import {
  createDefaultAudioOperations,
  MAX_AUDIO_DURATION_MS,
  MAX_AUDIO_MERGE_CLIPS,
  MAX_AUDIO_SPEED,
  MIN_AUDIO_DURATION_MS,
  MIN_AUDIO_SPEED,
  type AudioOperations,
} from "@editflow/shared";

export function createDefaultOperations(): AudioOperations {
  return createDefaultAudioOperations();
}

export function operationsEqual(
  left: AudioOperations,
  right: AudioOperations,
): boolean {
  if (
    left.trim.startMs !== right.trim.startMs ||
    left.trim.endMs !== right.trim.endMs ||
    left.speed !== right.speed ||
    left.mergeAssetIds.length !== right.mergeAssetIds.length
  ) {
    return false;
  }

  return left.mergeAssetIds.every(
    (assetId, index) => assetId === right.mergeAssetIds[index],
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable duration with tenths, such as 3:42.5. */
export function formatDuration(milliseconds: number): string {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** Timestamp used inside editable trim fields, such as 0:07.250. */
export function formatTimestamp(milliseconds: number): string {
  const safe = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;

  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/**
 * Accepts plain seconds ("83.5"), m:ss ("1:23.5"), or h:mm:ss. Returns
 * milliseconds, or null when the value cannot be parsed.
 */
export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+(:\d{1,2}){0,2}(\.\d{1,3})?$/.test(trimmed)) {
    return null;
  }

  const parts = trimmed.split(":");
  const secondsPart = Number(parts.pop());
  let seconds = secondsPart;

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  if (parts.length > 0) {
    const minutes = Number(parts.pop());

    if (!Number.isInteger(minutes) || minutes < 0) {
      return null;
    }

    seconds += minutes * 60;
  }

  if (parts.length > 0) {
    const hours = Number(parts.pop());

    if (!Number.isInteger(hours) || hours < 0) {
      return null;
    }

    seconds += hours * 3600;
  }

  return Math.round(seconds * 1000);
}

export function effectiveTimelineDuration(
  operations: AudioOperations,
  totalDurationMs: number,
): number {
  const end = operations.trim.endMs ?? totalDurationMs;
  return Math.max(0, (end - operations.trim.startMs) / operations.speed);
}

export function validateOperations(
  operations: AudioOperations,
  totalDurationMs: number,
): string | null {
  if (
    operations.speed < MIN_AUDIO_SPEED ||
    operations.speed > MAX_AUDIO_SPEED
  ) {
    return `Playback speed must be between ${MIN_AUDIO_SPEED}× and ${MAX_AUDIO_SPEED}×.`;
  }

  if (totalDurationMs <= 0) {
    return "Choose at least one audio clip.";
  }

  if (operations.mergeAssetIds.length > MAX_AUDIO_MERGE_CLIPS) {
    return `You can merge at most ${MAX_AUDIO_MERGE_CLIPS} additional clips.`;
  }

  if (totalDurationMs > MAX_AUDIO_DURATION_MS) {
    return "Merged clips must be 10 minutes or shorter. Remove a clip.";
  }

  if (operations.trim.startMs >= totalDurationMs) {
    return "Trim start must be before the end of the audio.";
  }

  if (
    operations.trim.endMs !== null &&
    operations.trim.endMs > totalDurationMs
  ) {
    return "Trim end must be inside the audio timeline.";
  }

  if (
    operations.trim.endMs !== null &&
    operations.trim.endMs <= operations.trim.startMs
  ) {
    return "Trim end must be after the trim start.";
  }

  const trimmedDuration =
    (operations.trim.endMs ?? totalDurationMs) - operations.trim.startMs;
  const outputDuration = trimmedDuration / operations.speed;

  if (outputDuration < MIN_AUDIO_DURATION_MS) {
    return "The edited audio must be at least 0.5 seconds long.";
  }

  if (outputDuration > MAX_AUDIO_DURATION_MS) {
    return "The edited audio must be 10 minutes or shorter.";
  }

  return null;
}

export function summarizeOperations(operations: AudioOperations): string {
  const end =
    operations.trim.endMs === null
      ? "end"
      : formatDuration(operations.trim.endMs);
  const parts = [
    `Trim ${formatDuration(operations.trim.startMs)} to ${end}`,
    `${operations.speed.toFixed(2)}× speed`,
  ];

  if (operations.mergeAssetIds.length > 0) {
    parts.push(`${operations.mergeAssetIds.length + 1} clips merged`);
  }

  return parts.join(" · ");
}

export function downloadNameForBlob(name: string, mimeType: string): string {
  const base =
    name
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "editflow-audio";

  const extension =
    mimeType === "audio/wav"
      ? "wav"
      : mimeType === "audio/ogg"
        ? "ogg"
        : mimeType === "audio/mp4"
          ? "m4a"
          : "mp3";

  return `${base}-edited.${extension}`;
}
