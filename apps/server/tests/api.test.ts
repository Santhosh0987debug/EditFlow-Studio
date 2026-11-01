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
    create: vi.fn(),
    deleteMany: vi.fn(),
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

const validRegistration = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  password: "correct-horse-battery",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findMany.mockResolvedValue([]);
});

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
