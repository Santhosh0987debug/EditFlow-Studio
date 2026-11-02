import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
  type ImageOperations,
} from "@editflow/shared";
import sharp, { type Sharp } from "sharp";
import { AppError } from "../../lib/app-error";

export type SupportedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export interface ImageMetadata {
  mimeType: SupportedImageMimeType;
  extension: string;
  width: number;
  height: number;
  byteSize: number;
}

export interface RenderedImage {
  data: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

const FORMAT_DETAILS: Record<
  "jpeg" | "png" | "webp",
  { mimeType: SupportedImageMimeType; extension: string }
> = {
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  png: { mimeType: "image/png", extension: "png" },
  webp: { mimeType: "image/webp", extension: "webp" },
};

const MAX_IMAGE_PIXELS = 40_000_000;

const INVALID_IMAGE_MESSAGE =
  "Choose a valid JPEG, PNG, or WebP image and try again.";

function isSupportedFormat(
  format: string | undefined,
): format is keyof typeof FORMAT_DETAILS {
  return (
    format === "jpeg" ||
    format === "png" ||
    format === "webp"
  );
}

function orientedDimensions(metadata: sharp.Metadata): {
  width: number;
  height: number;
} {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const orientation = metadata.orientation ?? 1;
  const swapped = orientation >= 5 && orientation <= 8;

  return {
    width: swapped ? height : width,
    height: swapped ? width : height,
  };
}

/**
 * Validate the bytes themselves rather than trusting the browser-provided MIME
 * type. The returned dimensions account for EXIF orientation.
 */
export async function inspectImage(buffer: Buffer): Promise<ImageMetadata> {
  if (buffer.byteLength === 0) {
    throw new AppError(400, INVALID_IMAGE_MESSAGE, { image: INVALID_IMAGE_MESSAGE });
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    const message = "The image must be 10 MB or smaller.";
    throw new AppError(413, message, { image: message });
  }

  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    throw new AppError(400, INVALID_IMAGE_MESSAGE, { image: INVALID_IMAGE_MESSAGE });
  }

  if (!isSupportedFormat(metadata.format)) {
    throw new AppError(400, INVALID_IMAGE_MESSAGE, { image: INVALID_IMAGE_MESSAGE });
  }

  const { width, height } = orientedDimensions(metadata);

  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    const message = `The image must be at least ${MIN_IMAGE_DIMENSION} × ${MIN_IMAGE_DIMENSION} pixels.`;
    throw new AppError(400, message, { image: message });
  }

  if (
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    const message = `The image must be no larger than ${MAX_IMAGE_DIMENSION} pixels on either side and ${MAX_IMAGE_PIXELS / 1_000_000} megapixels in total.`;
    throw new AppError(400, message, { image: message });
  }

  const details = FORMAT_DETAILS[metadata.format];

  return {
    mimeType: details.mimeType,
    extension: details.extension,
    width,
    height,
    byteSize: buffer.byteLength,
  };
}

function applyColorAdjustments(
  image: Sharp,
  operations: ImageOperations,
): Sharp {
  let next = image;

  if (operations.brightness !== 0) {
    next = next.modulate({
      brightness: Math.max(0.05, 1 + operations.brightness / 100),
    });
  }

  if (operations.saturation !== 0) {
    next = next.modulate({
      saturation: Math.max(0, 1 + operations.saturation / 100),
    });
  }

  if (operations.contrast !== 0) {
    const factor = Math.max(0.01, 1 + operations.contrast / 100);
    const offset = 128 * (1 - factor);
    // A scalar keeps alpha untouched and remains valid when a grayscale
    // filter follows in the same pipeline.
    next = next.linear(factor, offset);
  }

  switch (operations.filter) {
    case "grayscale":
      next = next.grayscale();
      break;
    case "sepia":
      next = next.recomb([
        [0.393, 0.769, 0.189],
        [0.349, 0.686, 0.168],
        [0.272, 0.534, 0.131],
      ]);
      break;
    case "blur":
      next = next.blur(2);
      break;
    case "sharpen":
      next = next.sharpen();
      break;
    case "none":
      break;
  }

  return next;
}

function applyCrop(
  image: Sharp,
  operations: ImageOperations,
  width: number,
  height: number,
): Sharp {
  if (!operations.crop) {
    return image;
  }

  const left = Math.min(
    width - 1,
    Math.max(0, Math.round((operations.crop.left / 100) * width)),
  );
  const top = Math.min(
    height - 1,
    Math.max(0, Math.round((operations.crop.top / 100) * height)),
  );
  const cropWidth = Math.max(
    1,
    Math.min(
      width - left,
      Math.round((operations.crop.width / 100) * width),
    ),
  );
  const cropHeight = Math.max(
    1,
    Math.min(
      height - top,
      Math.round((operations.crop.height / 100) * height),
    ),
  );

  return image.extract({
    left,
    top,
    width: cropWidth,
    height: cropHeight,
  });
}

function applyResize(image: Sharp, operations: ImageOperations): Sharp {
  const { width, height } = operations.resize;

  if (width === null && height === null) {
    return image;
  }

  return image.resize({
    width: width ?? undefined,
    height: height ?? undefined,
    fit: "inside",
    withoutEnlargement: true,
  });
}

async function render(
  buffer: Buffer,
  operations: ImageOperations,
  output: "preview" | SupportedImageMimeType,
): Promise<RenderedImage> {
  const source = await inspectImage(buffer);
  const base = sharp(buffer, { failOn: "error" }).rotate();
  const cropped = applyCrop(base, operations, source.width, source.height);
  const adjusted = applyColorAdjustments(cropped, operations);
  const resized = applyResize(adjusted, operations);

  const mimeType = output === "preview" ? "image/webp" : output;

  let pipeline: Sharp;

  switch (mimeType) {
    case "image/jpeg":
      pipeline = resized.jpeg({ quality: 90, mozjpeg: true });
      break;
    case "image/png":
      pipeline = resized.png({ compressionLevel: 9 });
      break;
    case "image/webp":
      pipeline = resized.webp({ quality: 88 });
      break;
    default:
      throw new Error(`Unsupported image output type: ${mimeType}`);
  }

  try {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      data,
      mimeType,
      extension: extensionForMimeType(mimeType),
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new AppError(
      400,
      "The image could not be processed with those settings.",
    );
  }
}

export function renderImagePreview(
  buffer: Buffer,
  operations: ImageOperations,
): Promise<RenderedImage> {
  return render(buffer, operations, "preview");
}

export function renderEditedImage(
  buffer: Buffer,
  operations: ImageOperations,
  sourceMimeType: string,
): Promise<RenderedImage> {
  const mimeType = ALLOWED_IMAGE_MIME_TYPES.includes(
    sourceMimeType as SupportedImageMimeType,
  )
    ? (sourceMimeType as SupportedImageMimeType)
    : "image/png";

  return render(buffer, operations, mimeType);
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

export function downloadFilename(name: string, extension: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return `${base || "editflow-image"}.${extension}`;
}
