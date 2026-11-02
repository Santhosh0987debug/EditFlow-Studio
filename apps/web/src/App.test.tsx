import type {
  AudioAssetDto,
  AudioAssetSummaryDto,
  AudioVersionDto,
  ImageAssetDto,
  ImageAssetSummaryDto,
  ImageVersionDto,
  ProjectDto,
  TextDocumentDto,
  TextVersionDto,
  TextVersionSummaryDto,
  UserDto,
} from "@editflow/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getTextDocument: vi.fn(),
  listTextVersions: vi.fn(),
  getTextVersion: vi.fn(),
  saveTextVersion: vi.fn(),
  getAiStatus: vi.fn(),
  generateText: vi.fn(),
  listImages: vi.fn(),
  uploadImage: vi.fn(),
  getImage: vi.fn(),
  previewImage: vi.fn(),
  saveImageVersion: vi.fn(),
  exportImage: vi.fn(),
  listAudio: vi.fn(),
  uploadAudio: vi.fn(),
  getAudio: vi.fn(),
  previewAudio: vi.fn(),
  saveAudioVersion: vi.fn(),
  exportAudio: vi.fn(),
}));

vi.mock("./api/client", () => {
  class ApiClientError extends Error {
    status: number;
    fields?: Record<string, string>;

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

  return {
    ApiClientError,
    authApi: {
      me: apiMocks.me,
      login: apiMocks.login,
      register: apiMocks.register,
      logout: apiMocks.logout,
    },
    projectsApi: {
      list: apiMocks.listProjects,
      create: apiMocks.createProject,
      delete: apiMocks.deleteProject,
    },
    textApi: {
      getDocument: apiMocks.getTextDocument,
      listVersions: apiMocks.listTextVersions,
      getVersion: apiMocks.getTextVersion,
      saveVersion: apiMocks.saveTextVersion,
    },
    aiApi: {
      status: apiMocks.getAiStatus,
      generate: apiMocks.generateText,
    },
    imageApi: {
      list: apiMocks.listImages,
      upload: apiMocks.uploadImage,
      get: apiMocks.getImage,
      preview: apiMocks.previewImage,
      saveVersion: apiMocks.saveImageVersion,
      exportImage: apiMocks.exportImage,
      originalFileUrl: (projectId: string, imageId: string) =>
        `/api/projects/${projectId}/images/${imageId}/file`,
      versionFileUrl: (
        projectId: string,
        imageId: string,
        versionId: string,
        download = false,
      ) =>
        `/api/projects/${projectId}/images/${imageId}/versions/${versionId}/file${
          download ? "?download=1" : ""
        }`,
    },
    audioApi: {
      list: apiMocks.listAudio,
      upload: apiMocks.uploadAudio,
      get: apiMocks.getAudio,
      preview: apiMocks.previewAudio,
      saveVersion: apiMocks.saveAudioVersion,
      exportAudio: apiMocks.exportAudio,
      originalFileUrl: (projectId: string, audioId: string) =>
        `/api/projects/${projectId}/audio/${audioId}/file`,
      versionFileUrl: (
        projectId: string,
        audioId: string,
        versionId: string,
        download = false,
      ) =>
        `/api/projects/${projectId}/audio/${audioId}/versions/${versionId}/file${
          download ? "?download=1" : ""
        }`,
    },
  };
});

import { ApiClientError } from "./api/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";

const testUser: UserDto = {
  id: "user_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  createdAt: "2026-01-01T09:00:00.000Z",
};

const testProject: ProjectDto = {
  id: "project_123",
  name: "Launch teaser",
  description: "A short product announcement.",
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T09:00:00.000Z",
};

const latestVersion: TextVersionDto = {
  id: "version_2",
  version: 2,
  title: "Launch teaser",
  content: "First draft",
  source: "manual",
  characterCount: 11,
  createdAt: "2026-01-01T10:00:00.000Z",
};

const latestVersionSummary: TextVersionSummaryDto = {
  id: latestVersion.id,
  version: latestVersion.version,
  title: latestVersion.title,
  source: latestVersion.source,
  characterCount: latestVersion.characterCount,
  createdAt: latestVersion.createdAt,
};

const earlierVersion: TextVersionDto = {
  id: "version_1",
  version: 1,
  title: "Older draft",
  content: "Earlier text",
  source: "manual",
  characterCount: 12,
  createdAt: "2026-01-01T09:30:00.000Z",
};

const earlierVersionSummary: TextVersionSummaryDto = {
  id: earlierVersion.id,
  version: earlierVersion.version,
  title: earlierVersion.title,
  source: earlierVersion.source,
  characterCount: earlierVersion.characterCount,
  createdAt: earlierVersion.createdAt,
};

const testTextDocument: TextDocumentDto = {
  id: "document_123",
  projectId: testProject.id,
  title: "Launch teaser",
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  versionCount: 2,
  latestVersion,
};

const aiStatusUnconfigured = {
  configured: false,
  provider: null,
  model: null,
  message:
    "AI editing is not configured. Set AI_PROVIDER=openai-compatible, AI_API_KEY, and AI_MODEL on the server to enable AI editing.",
};

const aiStatusConfigured = {
  configured: true,
  provider: "openai-compatible",
  model: "test-model",
  message: "AI editing is configured with openai-compatible (test-model).",
};

const originalImageVersion: ImageVersionDto = {
  id: "image_version_1",
  version: 1,
  source: "original",
  mimeType: "image/png",
  width: 800,
  height: 600,
  byteSize: 125_000,
  operations: null,
  createdAt: "2026-01-01T09:00:00.000Z",
};

const editedImageVersion: ImageVersionDto = {
  id: "image_version_2",
  version: 2,
  source: "edited",
  mimeType: "image/png",
  width: 640,
  height: 480,
  byteSize: 98_000,
  operations: {
    brightness: 12,
    contrast: 4,
    saturation: 0,
    filter: "none",
    crop: null,
    resize: { width: 640, height: null },
  },
  createdAt: "2026-01-01T10:00:00.000Z",
};

const testImageSummary: ImageAssetSummaryDto = {
  id: "image_123",
  projectId: testProject.id,
  name: "Launch visual",
  originalFilename: "launch-visual.png",
  mimeType: "image/png",
  width: 800,
  height: 600,
  byteSize: 125_000,
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T09:00:00.000Z",
  versionCount: 1,
  latestVersion: originalImageVersion,
};

const testImage: ImageAssetDto = {
  ...testImageSummary,
  originalVersion: originalImageVersion,
  versions: [originalImageVersion],
};

const originalAudioVersion: AudioVersionDto = {
  id: "audio_version_1",
  version: 1,
  source: "original",
  mimeType: "audio/mpeg",
  durationMs: 12_000,
  sampleRate: 44_100,
  channels: 2,
  byteSize: 180_000,
  operations: null,
  createdAt: "2026-01-01T09:00:00.000Z",
};

const editedAudioVersion: AudioVersionDto = {
  id: "audio_version_2",
  version: 2,
  source: "edited",
  mimeType: "audio/mpeg",
  durationMs: 7_600,
  sampleRate: 44_100,
  channels: 2,
  byteSize: 121_000,
  operations: {
    trim: { startMs: 500, endMs: 10_000 },
    speed: 1.25,
    mergeAssetIds: [],
  },
  createdAt: "2026-01-01T10:00:00.000Z",
};

const testAudioSummary: AudioAssetSummaryDto = {
  id: "audio_123",
  projectId: testProject.id,
  name: "Launch audio",
  originalFilename: "launch-audio.mp3",
  mimeType: "audio/mpeg",
  durationMs: 12_000,
  sampleRate: 44_100,
  channels: 2,
  byteSize: 180_000,
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-01T09:00:00.000Z",
  versionCount: 1,
  latestVersion: originalAudioVersion,
};

const testAudio: AudioAssetDto = {
  ...testAudioSummary,
  originalVersion: originalAudioVersion,
  versions: [originalAudioVersion],
};

const secondAudioSummary: AudioAssetSummaryDto = {
  ...testAudioSummary,
  id: "audio_456",
  name: "Second clip",
  originalFilename: "second-clip.mp3",
  durationMs: 8_000,
};

const thirdAudioSummary: AudioAssetSummaryDto = {
  ...testAudioSummary,
  id: "audio_789",
  name: "Third clip",
  originalFilename: "third-clip.mp3",
  durationMs: 4_000,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function signedOut() {
  apiMocks.me.mockResolvedValue({ user: null });
}

function signedIn() {
  apiMocks.me.mockResolvedValue({ user: testUser });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listProjects.mockResolvedValue({ projects: [] });
  apiMocks.getTextDocument.mockResolvedValue({ document: null });
  apiMocks.listTextVersions.mockResolvedValue({ versions: [] });
  apiMocks.getAiStatus.mockResolvedValue(aiStatusUnconfigured);
  apiMocks.listImages.mockResolvedValue({ images: [] });
  apiMocks.getImage.mockResolvedValue({ image: testImage });
  apiMocks.previewImage.mockResolvedValue(
    new Blob(["preview"], { type: "image/webp" }),
  );
  apiMocks.uploadImage.mockResolvedValue({ image: testImage });
  apiMocks.saveImageVersion.mockResolvedValue({
    version: editedImageVersion,
  });
  apiMocks.exportImage.mockResolvedValue(
    new Blob(["export"], { type: "image/png" }),
  );
  apiMocks.listAudio.mockResolvedValue({ audio: [] });
  apiMocks.getAudio.mockResolvedValue({ audio: testAudio });
  apiMocks.previewAudio.mockResolvedValue(
    new Blob(["preview"], { type: "audio/mpeg" }),
  );
  apiMocks.uploadAudio.mockResolvedValue({ audio: testAudio });
  apiMocks.saveAudioVersion.mockResolvedValue({
    version: editedAudioVersion,
  });
  apiMocks.exportAudio.mockResolvedValue(
    new Blob(["export"], { type: "audio/mpeg" }),
  );
  signedOut();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("landing page", () => {
  it("keeps the Phase 1 content and routes Get Started to registration", async () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", { level: 1, name: /editflow studio/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Prompt-first media editing workspace"),
    ).toBeInTheDocument();

    for (const media of ["Text", "Image", "Audio", "Video"]) {
      expect(
        screen.getByRole("heading", { level: 3, name: media }),
      ).toBeInTheDocument();
    }

    await screen.findAllByRole("link", { name: /sign in/i });
    const getStartedLinks = screen.getAllByRole("link", {
      name: /get started/i,
    });

    expect(getStartedLinks.length).toBeGreaterThan(0);
    for (const link of getStartedLinks) {
      expect(link).toHaveAttribute("href", "/register");
    }
  });
});

describe("authentication routing", () => {
  it("redirects signed-out visitors away from the dashboard", async () => {
    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /sign in to editflow/i,
      }),
    ).toBeInTheDocument();
  });

  it("signs in and lands on the dashboard", async () => {
    apiMocks.login.mockResolvedValueOnce({ user: testUser });

    renderAt("/login");

    fireEvent.change(await screen.findByLabelText(/^email$/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "correct-horse-battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /your projects/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/welcome back, ada/i),
    ).toBeInTheDocument();
    expect(apiMocks.login).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "correct-horse-battery",
    });
  });

  it("shows a login error returned by the API", async () => {
    apiMocks.login.mockRejectedValueOnce(
      new ApiClientError(401, "Invalid email or password."),
    );

    renderAt("/login");

    fireEvent.change(await screen.findByLabelText(/^email$/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
  });

  it("registers a new account and lands on the dashboard", async () => {
    apiMocks.register.mockResolvedValueOnce({ user: testUser });

    renderAt("/register");

    fireEvent.change(await screen.findByLabelText(/^name$/i), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "correct-horse-battery" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^create account$/i }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: /your projects/i }),
    ).toBeInTheDocument();
    expect(apiMocks.register).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct-horse-battery",
    });
  });

  it("signs out and returns to the login screen", async () => {
    apiMocks.me.mockResolvedValue({ user: testUser });
    apiMocks.logout.mockResolvedValueOnce(undefined);

    renderAt("/dashboard");

    await screen.findByRole("heading", { level: 1, name: /your projects/i });
    fireEvent.click(screen.getByRole("button", { name: /^sign out$/i }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /sign in to editflow/i,
      }),
    ).toBeInTheDocument();
    expect(apiMocks.logout).toHaveBeenCalledTimes(1);
  });
});

describe("dashboard projects", () => {
  it("creates, lists, and deletes a project", async () => {
    apiMocks.me.mockResolvedValue({ user: testUser });
    apiMocks.createProject.mockResolvedValue({ project: testProject });
    apiMocks.deleteProject.mockResolvedValue(undefined);

    renderAt("/dashboard");

    await screen.findByText("No projects yet");
    fireEvent.click(
      screen.getByRole("button", { name: /create your first project/i }),
    );

    fireEvent.change(screen.getByLabelText(/^project name$/i), {
      target: { value: "Launch teaser" },
    });
    fireEvent.change(screen.getByLabelText(/^description/i), {
      target: { value: "A short product announcement." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create project$/i }));

    expect(
      await screen.findByRole("heading", { level: 3, name: "Launch teaser" }),
    ).toBeInTheDocument();
    expect(apiMocks.createProject).toHaveBeenCalledWith({
      name: "Launch teaser",
      description: "A short product announcement.",
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(
      screen.getByRole("button", { name: /delete launch teaser/i }),
    );

    await waitFor(() => {
      expect(apiMocks.deleteProject).toHaveBeenCalledWith(testProject.id);
    });
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Project deleted.")).toBeInTheDocument();
  });

  it("does not delete when the confirmation is dismissed", async () => {
    apiMocks.me.mockResolvedValue({ user: testUser });
    apiMocks.listProjects.mockResolvedValueOnce({ projects: [testProject] });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", { level: 3, name: "Launch teaser" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /delete launch teaser/i }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(apiMocks.deleteProject).not.toHaveBeenCalled();
  });

  it("links each project to the text, image, and audio editors", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValueOnce({ projects: [testProject] });

    renderAt("/dashboard");

    const textLink = await screen.findByRole("link", {
      name: /open editor for launch teaser/i,
    });
    const imageLink = screen.getByRole("link", {
      name: /open image editor for launch teaser/i,
    });
    const audioLink = screen.getByRole("link", {
      name: /open audio editor for launch teaser/i,
    });

    expect(textLink).toHaveAttribute(
      "href",
      `/editor?project=${testProject.id}`,
    );
    expect(imageLink).toHaveAttribute(
      "href",
      `/image-editor?project=${testProject.id}`,
    );
    expect(audioLink).toHaveAttribute(
      "href",
      `/audio-editor?project=${testProject.id}`,
    );
  });
});

describe("text editor", () => {
  function renderEditor() {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    return renderAt(`/editor?project=${testProject.id}`);
  }

  it("loads the saved document and version history", async () => {
    apiMocks.getTextDocument.mockResolvedValue({
      document: testTextDocument,
    });
    apiMocks.listTextVersions.mockResolvedValue({
      versions: [latestVersionSummary, earlierVersionSummary],
    });

    renderEditor();

    expect(await screen.findByLabelText(/document title/i)).toHaveValue(
      "Launch teaser",
    );
    expect(screen.getByLabelText(/document content/i)).toHaveValue(
      "First draft",
    );
    expect(screen.getByLabelText("Project")).toHaveValue(testProject.id);
    expect(screen.getByText("v2 · Launch teaser")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open version 1/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
  });

  it("auto-selects the first project when the URL has none", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.getTextDocument.mockResolvedValue({
      document: testTextDocument,
    });

    renderAt("/editor");

    await waitFor(() => {
      expect(apiMocks.getTextDocument).toHaveBeenCalledWith(testProject.id);
    });
    expect(await screen.findByLabelText(/document title/i)).toHaveValue(
      "Launch teaser",
    );
    expect(screen.getByLabelText("Project")).toHaveValue(testProject.id);
  });

  it("asks the user to create a project when the workspace is empty", async () => {
    signedIn();

    renderAt("/editor");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /create a project first/i,
      }),
    ).toBeInTheDocument();
  });

  it("saves a new version and adds it to history", async () => {
    const savedVersion: TextVersionDto = {
      ...latestVersion,
      id: "version_1",
      version: 1,
      title: "Chapter one",
      content: "Hello world.",
      characterCount: 12,
    };
    apiMocks.getTextDocument.mockResolvedValue({ document: null });
    apiMocks.saveTextVersion.mockResolvedValue({
      document: {
        ...testTextDocument,
        title: savedVersion.title,
        versionCount: 1,
        latestVersion: savedVersion,
      },
      version: savedVersion,
    });

    renderEditor();

    fireEvent.change(await screen.findByLabelText(/document title/i), {
      target: { value: "Chapter one" },
    });
    fireEvent.change(screen.getByLabelText(/document content/i), {
      target: { value: "Hello world." },
    });
    fireEvent.click(screen.getByRole("button", { name: /save version/i }));

    await waitFor(() => {
      expect(apiMocks.saveTextVersion).toHaveBeenCalledWith(testProject.id, {
        title: "Chapter one",
        content: "Hello world.",
        source: "manual",
      });
    });
    expect(await screen.findByText(/version 1 saved/i)).toBeInTheDocument();
    expect(screen.getByText("v1 · Chapter one")).toBeInTheDocument();
    expect(
      screen.queryByText(/no saved versions yet/i),
    ).not.toBeInTheDocument();
  });

  it("reopens an earlier version, compares it with the saved version, and restores it", async () => {
    const restoredVersion: TextVersionDto = {
      ...earlierVersion,
      id: "version_3",
      version: 3,
      source: "restored",
    };
    apiMocks.getTextDocument.mockResolvedValue({
      document: testTextDocument,
    });
    apiMocks.listTextVersions.mockResolvedValue({
      versions: [latestVersionSummary, earlierVersionSummary],
    });
    apiMocks.getTextVersion.mockResolvedValue({ version: earlierVersion });
    apiMocks.saveTextVersion.mockResolvedValue({
      document: {
        ...testTextDocument,
        versionCount: 3,
        latestVersion: restoredVersion,
      },
      version: restoredVersion,
    });

    renderEditor();

    await screen.findByLabelText(/document title/i);
    fireEvent.click(screen.getByRole("button", { name: /open version 1/i }));

    await waitFor(() => {
      expect(apiMocks.getTextVersion).toHaveBeenCalledWith(
        testProject.id,
        earlierVersion.id,
      );
    });
    expect(await screen.findByDisplayValue("Older draft")).toBeInTheDocument();
    expect(screen.getByLabelText(/document content/i)).toHaveValue(
      "Earlier text",
    );
    expect(screen.getByText(/previous version open/i)).toBeInTheDocument();
    expect(screen.getByText(/version 1 reopened/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /compare saved/i }));

    const comparison = await screen.findByRole("region", {
      name: /original versus edited comparison/i,
    });
    expect(within(comparison).getByText("First draft")).toBeInTheDocument();
    expect(within(comparison).getByText("Earlier text")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save version/i }));

    await waitFor(() => {
      expect(apiMocks.saveTextVersion).toHaveBeenCalledWith(
        testProject.id,
        expect.objectContaining({
          title: "Older draft",
          content: "Earlier text",
          source: "restored",
        }),
      );
    });
    expect(screen.getByText("v3 · Older draft")).toBeInTheDocument();
  });

  it("explains how to configure AI instead of faking a result", async () => {
    apiMocks.getTextDocument.mockResolvedValue({
      document: testTextDocument,
    });

    renderEditor();

    expect(
      await screen.findByText(/Set AI_PROVIDER=openai-compatible/),
    ).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /generate proposal/i }),
    ).not.toBeInTheDocument();
  });

  it("compares, accepts, and saves an AI proposal", async () => {
    const acceptedVersion: TextVersionDto = {
      ...latestVersion,
      id: "version_3",
      version: 3,
      content: "Polished text.",
      source: "ai_accepted",
      characterCount: 13,
    };
    apiMocks.getAiStatus.mockResolvedValue(aiStatusConfigured);
    apiMocks.getTextDocument.mockResolvedValue({
      document: testTextDocument,
    });
    apiMocks.listTextVersions.mockResolvedValue({
      versions: [latestVersionSummary],
    });
    apiMocks.generateText.mockResolvedValue({
      proposal: {
        text: "Polished text.",
        notes: ["Improved clarity."],
        action: "rewrite",
        provider: "openai-compatible",
        model: "test-model",
      },
    });
    apiMocks.saveTextVersion.mockResolvedValue({
      document: {
        ...testTextDocument,
        versionCount: 3,
        latestVersion: acceptedVersion,
      },
      version: acceptedVersion,
    });

    renderEditor();

    const content = await screen.findByLabelText(/document content/i);
    fireEvent.change(content, { target: { value: "Draft text." } });
    fireEvent.click(
      screen.getByRole("button", { name: /generate proposal/i }),
    );

    await waitFor(() => {
      expect(apiMocks.generateText).toHaveBeenCalledWith({
        action: "rewrite",
        content: "Draft text.",
      });
    });

    const comparison = await screen.findByRole("region", {
      name: /original versus edited comparison/i,
    });
    expect(within(comparison).getByText("Draft text.")).toBeInTheDocument();
    expect(within(comparison).getByText("Polished text.")).toBeInTheDocument();
    expect(within(comparison).getByText("Improved clarity.")).toBeInTheDocument();

    fireEvent.click(
      within(comparison).getByRole("button", { name: /accept changes/i }),
    );

    expect(screen.getByLabelText(/document content/i)).toHaveValue(
      "Polished text.",
    );
    expect(
      screen.getByText(/AI changes applied to the draft/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save version/i }));

    await waitFor(() => {
      expect(apiMocks.saveTextVersion).toHaveBeenCalledWith(
        testProject.id,
        expect.objectContaining({
          content: "Polished text.",
          source: "ai_accepted",
        }),
      );
    });
    expect(screen.getByText("v3 · Launch teaser")).toBeInTheDocument();
  });

  it("rejects an AI proposal without changing the draft", async () => {
    apiMocks.getAiStatus.mockResolvedValue(aiStatusConfigured);
    apiMocks.getTextDocument.mockResolvedValue({
      document: testTextDocument,
    });
    apiMocks.generateText.mockResolvedValue({
      proposal: {
        text: "Polished text.",
        notes: ["Improved clarity."],
        action: "rewrite",
        provider: "openai-compatible",
        model: "test-model",
      },
    });

    renderEditor();

    const content = await screen.findByLabelText(/document content/i);
    fireEvent.change(content, { target: { value: "Draft text." } });
    fireEvent.click(
      screen.getByRole("button", { name: /generate proposal/i }),
    );

    const comparison = await screen.findByRole("region", {
      name: /original versus edited comparison/i,
    });
    fireEvent.click(
      within(comparison).getByRole("button", { name: /reject changes/i }),
    );

    expect(
      screen.queryByRole("region", {
        name: /original versus edited comparison/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/document content/i)).toHaveValue(
      "Draft text.",
    );
    expect(
      screen.getByText(/AI proposal rejected\. Your text is unchanged/i),
    ).toBeInTheDocument();
    expect(apiMocks.saveTextVersion).not.toHaveBeenCalled();
  });

  it("shows a retryable error when the document cannot be loaded", async () => {
    apiMocks.getTextDocument.mockRejectedValue(
      new ApiClientError(500, "The document could not be loaded."),
    );

    renderEditor();

    expect(
      await screen.findByText("The document could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});

describe("audio editor", () => {
  function renderAudioEditor(
    clipList: AudioAssetSummaryDto[] = [testAudioSummary],
  ) {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listAudio.mockResolvedValue({ audio: clipList });
    return renderAt(`/audio-editor?project=${testProject.id}`);
  }

  it("loads the audio clip, original, edited preview, and version history", async () => {
    renderAudioEditor();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /cut, speed up, and layer sound/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", {
        name: /original versus edited audio comparison/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/launch audio original audio/i),
    ).toHaveAttribute(
      "src",
      `/api/projects/${testProject.id}/audio/${testAudio.id}/file`,
    );
    await waitFor(() => {
      expect(
        screen
          .getByLabelText(/launch audio edited audio preview/i)
          .getAttribute("src"),
      ).toMatch(/^blob:/);
    });
    expect(screen.getByText(/v1 .* Original/)).toBeInTheDocument();
    expect(screen.getByText(/all edits saved/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Version 1 audio"),
    ).toHaveAttribute(
      "src",
      `/api/projects/${testProject.id}/audio/${testAudio.id}/versions/audio_version_1/file`,
    );
    expect(apiMocks.previewAudio).toHaveBeenCalledWith(
      testProject.id,
      testAudio.id,
      expect.objectContaining({
        trim: { startMs: 0, endMs: null },
        speed: 1,
        mergeAssetIds: [],
      }),
    );
  });

  it("auto-selects the first project when the URL has none", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listAudio.mockResolvedValue({ audio: [testAudioSummary] });

    renderAt("/audio-editor");

    await waitFor(() => {
      expect(apiMocks.getAudio).toHaveBeenCalledWith(
        testProject.id,
        testAudio.id,
      );
    });
    expect(await screen.findByLabelText("Project")).toHaveValue(
      testProject.id,
    );
  });

  it("shows the empty state and uploads the first audio clip", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listAudio.mockResolvedValue({ audio: [] });

    renderAt(`/audio-editor?project=${testProject.id}`);

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /add the first audio clip/i,
      }),
    ).toBeInTheDocument();

    const file = new File(["mp3"], "launch-audio.mp3", {
      type: "audio/mpeg",
    });
    fireEvent.change(
      screen.getByLabelText("Upload audio", { selector: "input" }),
      {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(apiMocks.uploadAudio).toHaveBeenCalledWith(testProject.id, file);
    });
    expect(await screen.findByText(/audio uploaded/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: /open audio launch audio/i,
      }),
    ).toBeInTheDocument();
  });

  it("validates file type before uploading", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listAudio.mockResolvedValue({ audio: [] });

    renderAt(`/audio-editor?project=${testProject.id}`);

    await screen.findByRole("heading", {
      level: 2,
      name: /add the first audio clip/i,
    });
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    fireEvent.change(
      screen.getByLabelText("Upload audio", { selector: "input" }),
      {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/Choose an MP3, WAV, OGG, or M4A/i),
    ).toBeInTheDocument();
    expect(apiMocks.uploadAudio).not.toHaveBeenCalled();
  });

  it("previews trim timestamps, speed changes, and reset", async () => {
    renderAudioEditor();

    const start = await screen.findByLabelText("Start timestamp");
    fireEvent.change(start, { target: { value: "1.5" } });
    fireEvent.blur(start);

    const end = screen.getByLabelText("End timestamp");
    fireEvent.change(end, { target: { value: "5" } });
    fireEvent.blur(end);

    fireEvent.change(screen.getByLabelText("Playback speed"), {
      target: { value: "1.5" },
    });

    await waitFor(() => {
      expect(apiMocks.previewAudio).toHaveBeenLastCalledWith(
        testProject.id,
        testAudio.id,
        {
          trim: { startMs: 1500, endMs: 5000 },
          speed: 1.5,
          mergeAssetIds: [],
        },
      );
    });
    expect(screen.getByText(/unsaved edits/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
    expect(screen.getByLabelText("Start timestamp")).toHaveValue("0:00.000");
    expect(screen.getByLabelText("Playback speed")).toHaveValue("1");
    expect(screen.getByText(/all edits saved/i)).toBeInTheDocument();
  });

  it("merges clips in the chosen order", async () => {
    renderAudioEditor([
      testAudioSummary,
      secondAudioSummary,
      thirdAudioSummary,
    ]);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /add second clip to merge/i,
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /add third clip to merge/i,
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /move third clip earlier/i,
      }),
    );

    await waitFor(() => {
      expect(apiMocks.previewAudio).toHaveBeenLastCalledWith(
        testProject.id,
        testAudio.id,
        expect.objectContaining({
          mergeAssetIds: ["audio_789", "audio_456"],
        }),
      );
    });
    expect(screen.getAllByText(/3 clips/i).length).toBeGreaterThan(0);
  });

  it("saves the current edit as a new version", async () => {
    renderAudioEditor();

    fireEvent.change(await screen.findByLabelText("Playback speed"), {
      target: { value: "1.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /save edited version/i }),
    );

    await waitFor(() => {
      expect(apiMocks.saveAudioVersion).toHaveBeenCalledWith(
        testProject.id,
        testAudio.id,
        {
          operations: expect.objectContaining({
            speed: 1.5,
            trim: { startMs: 0, endMs: null },
          }),
        },
      );
    });
    expect(await screen.findByText(/version 2 saved/i)).toBeInTheDocument();
    expect(screen.getByText(/v2 .* Edited/)).toBeInTheDocument();
    expect(screen.getByText(/all edits saved/i)).toBeInTheDocument();
  });

  it("exports the edited audio with the current settings", async () => {
    renderAudioEditor();
    await screen.findByLabelText("Playback speed");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    fireEvent.click(
      screen.getByRole("button", { name: /export edited audio/i }),
    );

    await waitFor(() => {
      expect(apiMocks.exportAudio).toHaveBeenCalledWith(
        testProject.id,
        testAudio.id,
        expect.objectContaining({
          speed: 1,
          trim: { startMs: 0, endMs: null },
        }),
      );
    });
    expect(
      await screen.findByText(/exported as an mp3/i),
    ).toBeInTheDocument();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("restores settings from a saved audio version", async () => {
    apiMocks.getAudio.mockResolvedValue({
      audio: {
        ...testAudio,
        versionCount: 2,
        latestVersion: editedAudioVersion,
        versions: [editedAudioVersion, originalAudioVersion],
      },
    });

    renderAudioEditor();

    expect(await screen.findByText(/v2 .* Edited/)).toBeInTheDocument();
    expect(await screen.findByLabelText("Playback speed")).toHaveValue("1.25");

    fireEvent.click(
      screen.getByRole("button", { name: /restore original settings/i }),
    );
    expect(screen.getByLabelText("Playback speed")).toHaveValue("1");
    expect(
      screen.getByText(/original settings restored in the editor/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /use settings from version 2/i }),
    );
    expect(screen.getByLabelText("Playback speed")).toHaveValue("1.25");
  });

  it("shows a retryable error when audio cannot be loaded", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listAudio.mockRejectedValueOnce(
      new ApiClientError(500, "Audio could not be loaded."),
    );

    renderAt(`/audio-editor?project=${testProject.id}`);

    expect(
      await screen.findByText("Audio could not be loaded."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(apiMocks.listAudio).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /add the first audio clip/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("image editor", () => {
  function renderImageEditor() {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listImages.mockResolvedValue({ images: [testImageSummary] });
    return renderAt(`/image-editor?project=${testProject.id}`);
  }

  it("loads the image, original, edited preview, and version history", async () => {
    renderImageEditor();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /shape the image/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", {
        name: /original versus edited image comparison/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByAltText(/launch visual before edits/i)).toHaveAttribute(
      "src",
      `/api/projects/${testProject.id}/images/${testImage.id}/file`,
    );
    await waitFor(() => {
      expect(
        screen
          .getByAltText(/launch visual after edits/i)
          .getAttribute("src"),
      ).toMatch(/^blob:/);
    });
    expect(screen.getByText("v1 · Original")).toBeInTheDocument();
    expect(screen.getByText(/all adjustments saved/i)).toBeInTheDocument();
    expect(apiMocks.previewImage).toHaveBeenCalledWith(
      testProject.id,
      testImage.id,
      expect.objectContaining({ brightness: 0 }),
    );
  });

  it("auto-selects the first project when the URL has none", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listImages.mockResolvedValue({ images: [testImageSummary] });

    renderAt("/image-editor");

    await waitFor(() => {
      expect(apiMocks.getImage).toHaveBeenCalledWith(
        testProject.id,
        testImage.id,
      );
    });
    expect(await screen.findByLabelText("Project")).toHaveValue(
      testProject.id,
    );
  });

  it("asks the user to create a project when the workspace is empty", async () => {
    signedIn();

    renderAt("/image-editor");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /create a project first/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows the empty state and uploads the first image", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listImages.mockResolvedValue({ images: [] });

    renderAt(`/image-editor?project=${testProject.id}`);

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /add the first image/i,
      }),
    ).toBeInTheDocument();

    const file = new File(["png"], "launch-visual.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(apiMocks.uploadImage).toHaveBeenCalledWith(testProject.id, file);
    });
    expect(await screen.findByText(/image uploaded/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: /open image launch visual/i,
      }),
    ).toBeInTheDocument();
  });

  it("previews adjustments, undoes them, and resets to the original", async () => {
    renderImageEditor();

    const brightness = await screen.findByLabelText("Brightness");
    fireEvent.change(brightness, { target: { value: "20" } });

    expect(brightness).toHaveValue("20");
    await waitFor(() => {
      expect(apiMocks.previewImage).toHaveBeenLastCalledWith(
        testProject.id,
        testImage.id,
        expect.objectContaining({ brightness: 20 }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(screen.getByLabelText("Brightness")).toHaveValue("0");

    fireEvent.change(screen.getByLabelText("Contrast"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
    expect(screen.getByLabelText("Contrast")).toHaveValue("0");
    expect(screen.getByText(/all adjustments saved/i)).toBeInTheDocument();
  });

  it("saves the current adjustments as a new version", async () => {
    renderImageEditor();

    fireEvent.change(await screen.findByLabelText("Brightness"), {
      target: { value: "20" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /save edited version/i }),
    );

    await waitFor(() => {
      expect(apiMocks.saveImageVersion).toHaveBeenCalledWith(
        testProject.id,
        testImage.id,
        { operations: expect.objectContaining({ brightness: 20 }) },
      );
    });
    expect(await screen.findByText(/version 2 saved/i)).toBeInTheDocument();
    expect(screen.getByText("v2 · Edited")).toBeInTheDocument();
    expect(screen.getByText(/all adjustments saved/i)).toBeInTheDocument();
  });

  it("exports the edited image with the current settings", async () => {
    renderImageEditor();
    await screen.findByLabelText("Brightness");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    fireEvent.click(
      screen.getByRole("button", { name: /export edited image/i }),
    );

    await waitFor(() => {
      expect(apiMocks.exportImage).toHaveBeenCalledWith(
        testProject.id,
        testImage.id,
        expect.objectContaining({ brightness: 0 }),
      );
    });
    expect(
      await screen.findByText(/exported with your current adjustments/i),
    ).toBeInTheDocument();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("restores settings from a saved version", async () => {
    apiMocks.getImage.mockResolvedValue({
      image: {
        ...testImage,
        versionCount: 2,
        latestVersion: editedImageVersion,
        versions: [editedImageVersion, originalImageVersion],
      },
    });

    renderImageEditor();

    expect(await screen.findByText("v2 · Edited")).toBeInTheDocument();
    expect(await screen.findByLabelText("Brightness")).toHaveValue("12");

    fireEvent.click(
      screen.getByRole("button", { name: /restore original settings/i }),
    );
    expect(screen.getByLabelText("Brightness")).toHaveValue("0");
    expect(
      screen.getByText(/original settings restored in the editor/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /use settings from version 2/i }),
    );
    expect(screen.getByLabelText("Brightness")).toHaveValue("12");
  });

  it("shows a retryable error when images cannot be loaded", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValue({ projects: [testProject] });
    apiMocks.listImages.mockRejectedValueOnce(
      new ApiClientError(500, "Images could not be loaded."),
    );

    renderAt(`/image-editor?project=${testProject.id}`);

    expect(
      await screen.findByText("Images could not be loaded."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(apiMocks.listImages).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /add the first image/i,
      }),
    ).toBeInTheDocument();
  });
});
