/**
 * The media categories EditFlow Studio is being built to support.
 * Editing features are not implemented yet.
 */
export type MediaKind = "text" | "image" | "audio" | "video";

/**
 * Response returned by GET /api/health.
 */
export interface HealthResponse {
  status: "ok";
  service: "editflow-studio-api";
  timestamp: string;
}

/**
 * Safe user data that can be returned to the browser.
 * Password hashes are never part of the public API.
 */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
}

/**
 * Response returned by GET /api/auth/me. Signed-out visitors receive null
 * instead of an error so the initial session check stays quiet in the browser.
 */
export interface SessionResponse {
  user: UserDto | null;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  projects: ProjectDto[];
}

export interface ProjectResponse {
  project: ProjectDto;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

/**
 * Consistent shape for API errors. `fields` is present for validation errors.
 */
export interface ApiErrorResponse {
  error: string;
  fields?: Record<string, string>;
}

/**
 * Text actions supported by the prompt-first editing panel.
 */
export type TextEditAction =
  | "rewrite"
  | "grammar"
  | "summarize"
  | "expand"
  | "tone"
  | "translate";

/**
 * How a saved text version came to exist. Versions are append-only.
 */
export type TextVersionSource = "manual" | "ai_accepted" | "restored";

export interface TextVersionSummaryDto {
  id: string;
  version: number;
  title: string;
  source: TextVersionSource;
  characterCount: number;
  createdAt: string;
}

export interface TextVersionDto extends TextVersionSummaryDto {
  content: string;
}

export interface TextDocumentDto {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  latestVersion: TextVersionDto | null;
}

export interface TextDocumentResponse {
  document: TextDocumentDto | null;
}

export interface SaveTextVersionRequest {
  title: string;
  content: string;
  source?: TextVersionSource;
}

export interface SaveTextVersionResponse {
  document: TextDocumentDto;
  version: TextVersionDto;
}

export interface TextVersionListResponse {
  versions: TextVersionSummaryDto[];
}

export interface TextVersionResponse {
  version: TextVersionDto;
}

export interface AiStatusResponse {
  configured: boolean;
  provider: string | null;
  model: string | null;
  message: string;
}

export interface AiTextRequest {
  action: TextEditAction;
  content: string;
  instruction?: string;
  tone?: string;
  targetLanguage?: string;
}

export interface AiTextProposalDto {
  text: string;
  notes: string[];
  action: TextEditAction;
  provider: string;
  model: string | null;
}

export interface AiTextResponse {
  proposal: AiTextProposalDto;
}

/**
 * Image formats accepted by the editor. SVG is intentionally excluded because
 * it can contain scripts and is not safely rasterized without extra validation.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_DIMENSION = 16;
export const MAX_IMAGE_DIMENSION = 8192;

/**
 * Basic non-destructive filters. `none` leaves the image colors unchanged.
 */
export type ImageFilter =
  | "none"
  | "grayscale"
  | "sepia"
  | "blur"
  | "sharpen";

/**
 * Crop rectangle expressed as percentages of the oriented source image.
 * `left + width` and `top + height` may not exceed 100.
 */
export interface ImageCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Resize target. Either side may be null to preserve the aspect ratio.
 * Images are always fitted inside the target and are never enlarged.
 */
export interface ImageResize {
  width: number | null;
  height: number | null;
}

/**
 * The full set of adjustments applied while producing an image preview,
 * export, or saved version. Keeping this as data makes edits repeatable.
 */
export interface ImageOperations {
  brightness: number;
  contrast: number;
  saturation: number;
  filter: ImageFilter;
  crop: ImageCrop | null;
  resize: ImageResize;
}

export function createDefaultImageOperations(): ImageOperations {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    filter: "none",
    crop: null,
    resize: { width: null, height: null },
  };
}

export const DEFAULT_IMAGE_OPERATIONS: ImageOperations =
  createDefaultImageOperations();

export type ImageVersionSource = "original" | "edited";

export interface ImageVersionDto {
  id: string;
  version: number;
  source: ImageVersionSource;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  operations: ImageOperations | null;
  createdAt: string;
}

export interface ImageAssetSummaryDto {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  latestVersion: ImageVersionDto | null;
}

export interface ImageAssetDto extends ImageAssetSummaryDto {
  originalVersion: ImageVersionDto | null;
  versions: ImageVersionDto[];
}

export interface ImageAssetListResponse {
  images: ImageAssetSummaryDto[];
}

export interface ImageAssetResponse {
  image: ImageAssetDto;
}

export interface SaveImageVersionRequest {
  operations: ImageOperations;
}

export interface SaveImageVersionResponse {
  version: ImageVersionDto;
}

export interface ImagePreviewRequest {
  operations: ImageOperations;
}

/**
 * Audio containers that are safe and practical to decode with FFmpeg and play
 * in modern browsers. The bytes are still inspected with ffprobe on upload.
 */
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
] as const;

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MIN_AUDIO_DURATION_MS = 500;
export const MAX_AUDIO_DURATION_MS = 10 * 60 * 1000;
export const MIN_AUDIO_SPEED = 0.5;
export const MAX_AUDIO_SPEED = 2;
export const MAX_AUDIO_MERGE_CLIPS = 8;
export const AUDIO_PREVIEW_MIME_TYPE = "audio/mpeg";

/**
 * Trim boundaries in milliseconds, measured from the start of the source
 * (including any merged clips). A null end keeps the rest of the audio.
 */
export interface AudioTrim {
  startMs: number;
  endMs: number | null;
}

/**
 * The complete, repeatable description of an audio edit. `mergeAssetIds`
 * contains additional project clips in playback order after the primary clip.
 */
export interface AudioOperations {
  trim: AudioTrim;
  speed: number;
  mergeAssetIds: string[];
}

export function createDefaultAudioOperations(): AudioOperations {
  return {
    trim: { startMs: 0, endMs: null },
    speed: 1,
    mergeAssetIds: [],
  };
}

export const DEFAULT_AUDIO_OPERATIONS: AudioOperations =
  createDefaultAudioOperations();

export type AudioVersionSource = "original" | "edited";

export interface AudioVersionDto {
  id: string;
  version: number;
  source: AudioVersionSource;
  mimeType: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  byteSize: number;
  operations: AudioOperations | null;
  createdAt: string;
}

export interface AudioAssetSummaryDto {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  latestVersion: AudioVersionDto | null;
}

export interface AudioAssetDto extends AudioAssetSummaryDto {
  originalVersion: AudioVersionDto | null;
  versions: AudioVersionDto[];
}

export interface AudioAssetListResponse {
  audio: AudioAssetSummaryDto[];
}

export interface AudioAssetResponse {
  audio: AudioAssetDto;
}

export interface SaveAudioVersionRequest {
  operations: AudioOperations;
}

export interface SaveAudioVersionResponse {
  version: AudioVersionDto;
}

export interface AudioPreviewRequest {
  operations: AudioOperations;
}
