import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("GET /api/health", () => {
  it("returns a JSON health response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({
      status: "ok",
      service: "editflow-studio-api",
      timestamp: expect.any(String),
    });

    const { timestamp } = response.body as { timestamp: string };
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404 response", async () => {
    const response = await request(app).get("/api/not-a-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });
});
