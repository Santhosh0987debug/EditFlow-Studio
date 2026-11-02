import type {
  AiStatusResponse,
  AiTextRequest,
  AiTextResponse,
  ApiErrorResponse,
  AuthResponse,
  CreateProjectRequest,
  LoginRequest,
  ProjectListResponse,
  ProjectResponse,
  RegisterRequest,
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

  const body = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | T
    | null;

  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login") {
      window.dispatchEvent(new Event("editflow:unauthorized"));
    }

    const errorBody = body as ApiErrorResponse | null;
    throw new ApiClientError(
      response.status,
      errorBody?.error ?? "Something went wrong. Please try again.",
      errorBody?.fields,
    );
  }

  return body as T;
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

export const aiApi = {
  status: () => request<AiStatusResponse>("/api/ai/status"),
  generate: (input: AiTextRequest) =>
    request<AiTextResponse>("/api/ai/generate", {
      method: "POST",
      body: input,
    }),
};
