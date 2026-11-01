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
