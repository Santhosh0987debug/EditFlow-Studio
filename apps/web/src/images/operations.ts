import {
  createDefaultImageOperations,
  type ImageFilter,
  type ImageOperations,
} from "@editflow/shared";

export const IMAGE_FILTER_OPTIONS: ReadonlyArray<{
  value: ImageFilter;
  label: string;
}> = [
  { value: "none", label: "Original colors" },
  { value: "grayscale", label: "Black and white" },
  { value: "sepia", label: "Sepia" },
  { value: "blur", label: "Soft blur" },
  { value: "sharpen", label: "Sharpen" },
];

export function createDefaultOperations(): ImageOperations {
  return createDefaultImageOperations();
}

export function operationsEqual(
  left: ImageOperations,
  right: ImageOperations,
): boolean {
  if (
    left.brightness !== right.brightness ||
    left.contrast !== right.contrast ||
    left.saturation !== right.saturation ||
    left.filter !== right.filter
  ) {
    return false;
  }

  if (left.crop === null || right.crop === null) {
    if (left.crop !== right.crop) {
      return false;
    }
  } else if (
    left.crop.left !== right.crop.left ||
    left.crop.top !== right.crop.top ||
    left.crop.width !== right.crop.width ||
    left.crop.height !== right.crop.height
  ) {
    return false;
  }

  return (
    left.resize.width === right.resize.width &&
    left.resize.height === right.resize.height
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

export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height}`;
}

export function downloadNameForBlob(name: string, mimeType: string): string {
  const base =
    name
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "editflow-image";

  const extension =
    mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/webp"
        ? "webp"
        : "png";

  return `${base}-edited.${extension}`;
}
