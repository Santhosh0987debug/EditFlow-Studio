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
 * Consistent shape for API errors.
 */
export interface ApiErrorResponse {
  error: string;
}
