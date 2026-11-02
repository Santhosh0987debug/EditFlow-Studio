import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  textDocument: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  textVersion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { app } from "../src/app";

const createdAt = new Date("2026-01-01T09:00:00.000Z");

const publicUser = {
  id: "user_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  createdAt,
};

const projectRecord = {
  id: "project_123",
  name: "Launch teaser",
  description: "A short product announcement.",
  createdAt,
  updatedAt: createdAt,
};

const textDocumentRecord = {
  id: "document_123",
  projectId: "project_123",
  title: "Launch teaser",
  createdAt,
  updatedAt: createdAt,
};

const textVersionRecord = {
  id: "version_1",
  version: 1,
  title: "Launch teaser",
  content: "A short **product** announcement.",
  source: "manual" as const,
  createdAt,
};

const validRegistration = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  password: "correct-horse-battery",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findMany.mockResolvedValue([]);
});

async function loginAgent(): Promise<ReturnType<typeof request.agent>> {
  const passwordHash = await bcrypt.hash("correct-horse-battery", 4);
  prismaMock.user.findUnique.mockResolvedValue({
    ...publicUser,
    passwordHash,
    updatedAt: createdAt,
  });

  const agent = request.agent(app);
  const loginResponse = await agent.post("/api/auth/login").send({
    email: "ada@example.com",
    password: "correct-horse-battery",
  });
  expect(loginResponse.status).toBe(200);

  return agent;
}

describe("authentication API", () => {
  it("registers a user, hashes the password, and starts a session", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(publicUser);

    const agent = request.agent(app);
    const response = await agent
      .post("/api/auth/register")
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      ...publicUser,
      createdAt: createdAt.toISOString(),
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const createCall = prismaMock.user.create.mock.calls[0]?.[0];
    expect(createCall.data.email).toBe("ada@example.com");
    expect(createCall.data.passwordHash).not.toBe(validRegistration.password);
    expect(
      await bcrypt.compare(
        validRegistration.password,
        createCall.data.passwordHash,
      ),
    ).toBe(true);

    const cookie = String(response.headers["set-cookie"]?.[0]);
    expect(cookie).toContain("editflow_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    prismaMock.user.findUnique.mockResolvedValueOnce(publicUser);
    const meResponse = await agent.get("/api/auth/me");

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe("ada@example.com");
  });

  it("returns validation errors for an invalid registration", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Please correct the highlighted fields.",
    );
    expect(response.body.fields).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate email addresses", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "existing_user" });

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegistration);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe(
      "An account with this email already exists.",
    );
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("logs in with valid credentials and rejects invalid ones generically", async () => {
    const passwordHash = await bcrypt.hash("correct-horse-battery", 4);
    const storedUser = {
      ...publicUser,
      passwordHash,
      updatedAt: createdAt,
    };

    prismaMock.user.findUnique.mockResolvedValue(storedUser);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "ADA@example.com",
      password: "correct-horse-battery",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe("ada@example.com");
    expect(loginResponse.headers["set-cookie"]).toBeDefined();

    const invalidResponse = await request(app).post("/api/auth/login").send({
      email: "ada@example.com",
      password: "wrong-password",
    });

    expect(invalidResponse.status).toBe(401);
    expect(invalidResponse.body.error).toBe("Invalid email or password.");
    expect(invalidResponse.headers["set-cookie"]).toBeUndefined();
  });

  it("logs out by clearing the session cookie", async () => {
    const passwordHash = await bcrypt.hash("correct-horse-battery", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      ...publicUser,
      passwordHash,
      updatedAt: createdAt,
    });

    const agent = request.agent(app);
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "ada@example.com",
      password: "correct-horse-battery",
    });
    expect(loginResponse.status).toBe(200);

    const logoutResponse = await agent.post("/api/auth/logout");
    expect(logoutResponse.status).toBe(204);

    const clearedCookie = String(logoutResponse.headers["set-cookie"]?.[0]);
    expect(clearedCookie).toContain("editflow_session=;");

    const meResponse = await agent.get("/api/auth/me");
    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({ user: null });
  });

  it("returns a null user when no session exists", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: null });
  });

  it("rejects a tampered session token without breaking the session check", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "editflow_session=tampered.token.value");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: null });
  });
});

describe("project API", () => {
  async function authenticatedAgent(): Promise<ReturnType<typeof request.agent>> {
    const passwordHash = await bcrypt.hash("correct-horse-battery", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      ...publicUser,
      passwordHash,
      updatedAt: createdAt,
    });

    const agent = request.agent(app);
    const loginResponse = await agent.post("/api/auth/login").send({
      email: "ada@example.com",
      password: "correct-horse-battery",
    });
    expect(loginResponse.status).toBe(200);

    return agent;
  }

  it("requires authentication to list projects", async () => {
    const response = await request(app).get("/api/projects");

    expect(response.status).toBe(401);
    expect(prismaMock.project.findMany).not.toHaveBeenCalled();
  });

  it("lists only the current user's projects", async () => {
    prismaMock.project.findMany.mockResolvedValueOnce([projectRecord]);
    const agent = await authenticatedAgent();

    const response = await agent.get("/api/projects");

    expect(response.status).toBe(200);
    expect(response.body.projects).toEqual([
      {
        ...projectRecord,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      },
    ]);
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: publicUser.id },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("creates a project owned by the current user", async () => {
    prismaMock.project.create.mockResolvedValueOnce(projectRecord);
    const agent = await authenticatedAgent();

    const response = await agent.post("/api/projects").send({
      name: "  Launch teaser  ",
      description: "  A short product announcement.  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.project.name).toBe("Launch teaser");
    expect(prismaMock.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "Launch teaser",
          description: "A short product announcement.",
          ownerId: publicUser.id,
        },
      }),
    );
  });

  it("validates project input", async () => {
    const agent = await authenticatedAgent();

    const response = await agent.post("/api/projects").send({
      name: "   ",
      description: "x".repeat(501),
    });

    expect(response.status).toBe(400);
    expect(response.body.fields.name).toBe("Project name is required.");
    expect(response.body.fields.description).toBeDefined();
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it("deletes an owned project", async () => {
    prismaMock.project.deleteMany.mockResolvedValueOnce({ count: 1 });
    const agent = await authenticatedAgent();

    const response = await agent.delete("/api/projects/project_123");

    expect(response.status).toBe(204);
    expect(prismaMock.project.deleteMany).toHaveBeenCalledWith({
      where: { id: "project_123", ownerId: publicUser.id },
    });
  });

  it("returns 404 for a project that is missing or owned by someone else", async () => {
    prismaMock.project.deleteMany.mockResolvedValueOnce({ count: 0 });
    const agent = await authenticatedAgent();

    const response = await agent.delete("/api/projects/not_owned");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Project not found.");
  });
});

describe("text document API", () => {
  const ownedProject = { id: "project_123", name: "Launch teaser" };

  it("requires authentication", async () => {
    const response = await request(app).get(
      "/api/projects/project_123/text",
    );

    expect(response.status).toBe(401);
    expect(prismaMock.textDocument.findUnique).not.toHaveBeenCalled();
  });

  it("returns a null document for an owned project without text", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.findUnique.mockResolvedValueOnce(null);
    const agent = await loginAgent();

    const response = await agent.get("/api/projects/project_123/text");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ document: null });
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: { id: "project_123", ownerId: publicUser.id },
      select: { id: true, name: true },
    });
  });

  it("returns the latest version with the document", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.findUnique.mockResolvedValueOnce(
      textDocumentRecord,
    );
    prismaMock.textVersion.findFirst.mockResolvedValueOnce(textVersionRecord);
    const agent = await loginAgent();

    const response = await agent.get("/api/projects/project_123/text");

    expect(response.status).toBe(200);
    expect(response.body.document).toEqual({
      ...textDocumentRecord,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      versionCount: 1,
      latestVersion: {
        ...textVersionRecord,
        createdAt: createdAt.toISOString(),
        characterCount: textVersionRecord.content.length,
      },
    });
  });

  it("creates the first version and links it to the project document", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.upsert.mockResolvedValueOnce(textDocumentRecord);
    prismaMock.textVersion.findFirst.mockResolvedValueOnce(null);
    prismaMock.textVersion.create.mockResolvedValueOnce(textVersionRecord);
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/text/versions")
      .send({
        title: "  Launch teaser  ",
        content: textVersionRecord.content,
      });

    expect(response.status).toBe(201);
    expect(response.body.version.version).toBe(1);
    expect(response.body.version.source).toBe("manual");
    expect(prismaMock.textDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project_123" },
        create: { projectId: "project_123", title: "Launch teaser" },
      }),
    );
    expect(prismaMock.textVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "document_123",
          version: 1,
          source: "manual",
        }),
      }),
    );
  });

  it("appends accepted AI versions without overwriting earlier ones", async () => {
    const acceptedVersion = {
      ...textVersionRecord,
      id: "version_2",
      version: 2,
      source: "ai_accepted" as const,
    };

    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.upsert.mockResolvedValueOnce(textDocumentRecord);
    prismaMock.textVersion.findFirst.mockResolvedValueOnce({ version: 1 });
    prismaMock.textVersion.create.mockResolvedValueOnce(acceptedVersion);
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/text/versions")
      .send({
        title: "Launch teaser",
        content: "A clearer product announcement.",
        source: "ai_accepted",
      });

    expect(response.status).toBe(201);
    expect(response.body.version).toMatchObject({
      id: "version_2",
      version: 2,
      source: "ai_accepted",
    });
    expect(prismaMock.textVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          source: "ai_accepted",
        }),
      }),
    );
  });

  it("validates saved version input", async () => {
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/text/versions")
      .send({
        title: "   ",
        content: "   ",
        source: "automatic",
      });

    expect(response.status).toBe(400);
    expect(response.body.fields.title).toBe("Document title is required.");
    expect(response.body.fields.content).toBe(
      "Document content cannot be empty.",
    );
    expect(prismaMock.textDocument.upsert).not.toHaveBeenCalled();
  });

  it("lists version metadata without full content", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.findUnique.mockResolvedValueOnce({
      id: "document_123",
    });
    prismaMock.textVersion.findMany.mockResolvedValueOnce([
      textVersionRecord,
    ]);
    const agent = await loginAgent();

    const response = await agent.get(
      "/api/projects/project_123/text/versions",
    );

    expect(response.status).toBe(200);
    expect(response.body.versions[0]).toMatchObject({
      id: "version_1",
      version: 1,
      characterCount: textVersionRecord.content.length,
    });
    expect(response.body.versions[0]).not.toHaveProperty("content");
  });

  it("returns a previous version for reopening", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.findUnique.mockResolvedValueOnce({
      id: "document_123",
    });
    prismaMock.textVersion.findFirst.mockResolvedValueOnce(textVersionRecord);
    const agent = await loginAgent();

    const response = await agent.get(
      "/api/projects/project_123/text/versions/version_1",
    );

    expect(response.status).toBe(200);
    expect(response.body.version.content).toBe(textVersionRecord.content);
    expect(prismaMock.textVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "version_1", documentId: "document_123" },
      }),
    );
  });

  it("hides projects and versions the user does not own", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null);
    const agent = await loginAgent();

    const documentResponse = await agent.get(
      "/api/projects/not_owned/text",
    );
    expect(documentResponse.status).toBe(404);
    expect(documentResponse.body.error).toBe("Project not found.");

    prismaMock.project.findFirst.mockResolvedValueOnce(ownedProject);
    prismaMock.textDocument.findUnique.mockResolvedValueOnce({
      id: "document_123",
    });
    prismaMock.textVersion.findFirst.mockResolvedValueOnce(null);

    const versionResponse = await agent.get(
      "/api/projects/project_123/text/versions/missing",
    );
    expect(versionResponse.status).toBe(404);
    expect(versionResponse.body.error).toBe("Version not found.");
  });
});

describe("AI API", () => {
  it("requires authentication", async () => {
    const statusResponse = await request(app).get("/api/ai/status");
    const generateResponse = await request(app)
      .post("/api/ai/generate")
      .send({
        action: "rewrite",
        content: "Some text.",
      });

    expect(statusResponse.status).toBe(401);
    expect(generateResponse.status).toBe(401);
  });

  it("reports missing provider configuration instead of pretending to work", async () => {
    const agent = await loginAgent();

    const response = await agent.get("/api/ai/status");

    expect(response.status).toBe(200);
    expect(response.body.configured).toBe(false);
    expect(response.body.message).toContain("AI editing is not configured");
  });

  it("validates action-specific AI input", async () => {
    const agent = await loginAgent();

    const toneResponse = await agent.post("/api/ai/generate").send({
      action: "tone",
      content: "Some text.",
    });
    const translationResponse = await agent.post("/api/ai/generate").send({
      action: "translate",
      content: "Some text.",
    });
    const emptyResponse = await agent.post("/api/ai/generate").send({
      action: "rewrite",
      content: "   ",
    });

    expect(toneResponse.status).toBe(400);
    expect(toneResponse.body.fields.tone).toBe(
      "Enter the tone you want to use.",
    );
    expect(translationResponse.status).toBe(400);
    expect(translationResponse.body.fields.targetLanguage).toBe(
      "Enter the language to translate into.",
    );
    expect(emptyResponse.status).toBe(400);
    expect(emptyResponse.body.fields.content).toBeDefined();
  });

  it("returns a clear configuration error when no provider is configured", async () => {
    const agent = await loginAgent();

    const response = await agent.post("/api/ai/generate").send({
      action: "grammar",
      content: "their going too the store.",
    });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("AI editing is not configured");
  });
});
