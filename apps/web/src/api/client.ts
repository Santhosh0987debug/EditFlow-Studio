import type {
  AiStatusResponse,
  AiTextRequest,
  AiTextResponse,
  ApiErrorResponse,
  AudioAssetListResponse,
  AudioAssetResponse,
  AudioOperations,
  AuthResponse,
  CreateProjectRequest,
  ImageAssetListResponse,
  ImageAssetResponse,
  ImageOperations,
  LoginRequest,
  ProjectListResponse,
  ProjectResponse,
  RegisterRequest,
  SaveAudioVersionRequest,
  SaveAudioVersionResponse,
  SaveImageVersionRequest,
  SaveImageVersionResponse,
  SaveTextVersionRequest,
  SaveTextVersionResponse,
  SessionResponse,
  TextDocumentResponse,
  TextVersionListResponse,
  TextVersionResponse,
} from "@editflow/shared";

export class ApiClientError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.fields = fields;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

async function throwResponseError(
  response: Response,
  path: string,
): Promise<never> {
  const body = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | null;

  if (response.status === 401 && path !== "/api/auth/login") {
    window.dispatchEvent(new Event("editflow:unauthorized"));
  }

  throw new ApiClientError(
    response.status,
    body?.error ?? "Something went wrong. Please try again.",
    body?.fields,
  );
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    return throwResponseError(response, path);
  }

  return (await response.json().catch(() => null)) as T;
}

async function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      Accept: "*/*",
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    return throwResponseError(response, path);
  }

  return response.blob();
}

async function requestUpload<T>(
  path: string,
  file: File,
  field: "image" | "audio" = "image",
): Promise<T> {
  const formData = new FormData();
  formData.append(field, file);

  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
    body: formData,
  });

  if (!response.ok) {
    return throwResponseError(response, path);
  }

  return (await response.json().catch(() => null)) as T;
}

export const authApi = {
  me: () => request<SessionResponse>("/api/auth/me"),
  login: (input: LoginRequest) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
    }),
  register: (input: RegisterRequest) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
    }),
  logout: () =>
    request<void>("/api/auth/logout", {
      method: "POST",
    }),
};

export const projectsApi = {
  list: () => request<ProjectListResponse>("/api/projects"),
  create: (input: CreateProjectRequest) =>
    request<ProjectResponse>("/api/projects", {
      method: "POST",
      body: input,
    }),
  delete: (projectId: string) =>
    request<void>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    }),
};

function textBasePath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/text`;
}

export const textApi = {
  getDocument: (projectId: string) =>
    request<TextDocumentResponse>(textBasePath(projectId)),
  listVersions: (projectId: string) =>
    request<TextVersionListResponse>(`${textBasePath(projectId)}/versions`),
  getVersion: (projectId: string, versionId: string) =>
    request<TextVersionResponse>(
      `${textBasePath(projectId)}/versions/${encodeURIComponent(versionId)}`,
    ),
  saveVersion: (projectId: string, input: SaveTextVersionRequest) =>
    request<SaveTextVersionResponse>(`${textBasePath(projectId)}/versions`, {
      method: "POST",
      body: input,
    }),
};

function imagesBasePath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/images`;
}

export const imageApi = {
  list: (projectId: string) =>
    request<ImageAssetListResponse>(imagesBasePath(projectId)),
  upload: (projectId: string, file: File) =>
    requestUpload<ImageAssetResponse>(imagesBasePath(projectId), file, "image"),
  get: (projectId: string, imageId: string) =>
    request<ImageAssetResponse>(
      `${imagesBasePath(projectId)}/${encodeURIComponent(imageId)}`,
    ),
  preview: (
    projectId: string,
    imageId: string,
    operations: ImageOperations,
  ) =>
    requestBlob(
      `${imagesBasePath(projectId)}/${encodeURIComponent(imageId)}/preview`,
      {
        method: "POST",
        body: { operations },
      },
    ),
  saveVersion: (
    projectId: string,
    imageId: string,
    input: SaveImageVersionRequest,
  ) =>
    request<SaveImageVersionResponse>(
      `${imagesBasePath(projectId)}/${encodeURIComponent(imageId)}/versions`,
      {
        method: "POST",
        body: input,
      },
    ),
  exportImage: (
    projectId: string,
    imageId: string,
    operations: ImageOperations,
  ) =>
    requestBlob(
      `${imagesBasePath(projectId)}/${encodeURIComponent(imageId)}/export`,
      {
        method: "POST",
        body: { operations },
      },
    ),
  originalFileUrl: (projectId: string, imageId: string) =>
    `${imagesBasePath(projectId)}/${encodeURIComponent(imageId)}/file`,
  versionFileUrl: (
    projectId: string,
    imageId: string,
    versionId: string,
    download = false,
  ) =>
    `${imagesBasePath(projectId)}/${encodeURIComponent(imageId)}/versions/${encodeURIComponent(versionId)}/file${
      download ? "?download=1" : ""
    }`,
};

function audioBasePath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/audio`;
}

export const audioApi = {
  list: (projectId: string) =>
    request<AudioAssetListResponse>(audioBasePath(projectId)),
  upload: (projectId: string, file: File) =>
    requestUpload<AudioAssetResponse>(audioBasePath(projectId), file, "audio"),
  get: (projectId: string, audioId: string) =>
    request<AudioAssetResponse>(
      `${audioBasePath(projectId)}/${encodeURIComponent(audioId)}`,
    ),
  preview: (
    projectId: string,
    audioId: string,
    operations: AudioOperations,
  ) =>
    requestBlob(
      `${audioBasePath(projectId)}/${encodeURIComponent(audioId)}/preview`,
      {
        method: "POST",
        body: { operations },
      },
    ),
  saveVersion: (
    projectId: string,
    audioId: string,
    input: SaveAudioVersionRequest,
  ) =>
    request<SaveAudioVersionResponse>(
      `${audioBasePath(projectId)}/${encodeURIComponent(audioId)}/versions`,
      {
        method: "POST",
        body: input,
      },
    ),
  exportAudio: (
    projectId: string,
    audioId: string,
    operations: AudioOperations,
  ) =>
    requestBlob(
      `${audioBasePath(projectId)}/${encodeURIComponent(audioId)}/export`,
      {
        method: "POST",
        body: { operations },
      },
    ),
  originalFileUrl: (projectId: string, audioId: string) =>
    `${audioBasePath(projectId)}/${encodeURIComponent(audioId)}/file`,
  versionFileUrl: (
    projectId: string,
    audioId: string,
    versionId: string,
    download = false,
  ) =>
    `${audioBasePath(projectId)}/${encodeURIComponent(audioId)}/versions/${encodeURIComponent(versionId)}/file${
      download ? "?download=1" : ""
    }`,
};

export const aiApi = {
  status: () => request<AiStatusResponse>("/api/ai/status"),
  generate: (input: AiTextRequest) =>
    request<AiTextResponse>("/api/ai/generate", {
      method: "POST",
      body: input,
    }),
};
