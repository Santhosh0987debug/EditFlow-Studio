import type {
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

  it("links each project to the text editor", async () => {
    signedIn();
    apiMocks.listProjects.mockResolvedValueOnce({ projects: [testProject] });

    renderAt("/dashboard");

    const link = await screen.findByRole("link", {
      name: /open editor for launch teaser/i,
    });

    expect(link).toHaveAttribute(
      "href",
      `/editor?project=${testProject.id}`,
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
