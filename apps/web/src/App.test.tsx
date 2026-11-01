import type { ProjectDto, UserDto } from "@editflow/shared";
import {
  fireEvent,
  render,
  screen,
  waitFor,
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

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.listProjects.mockResolvedValue({ projects: [] });
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
});
