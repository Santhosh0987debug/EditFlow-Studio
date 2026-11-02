import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_AUDIO_BYTES, type AudioOperations } from "@editflow/shared";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  audioAsset: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  audioVersion: {
    create: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { app } from "../src/app";
import {
  readAudioFile,
  saveAudioFile,
} from "../src/modules/audio/audio.storage";

const createdAt = new Date("2026-01-01T09:00:00.000Z");

const publicUser = {
  id: "user_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  createdAt,
};

const ownedProject = { id: "project_123", name: "Podcast episode" };

const assetRecord = {
  id: "audio_123",
  projectId: "project_123",
  name: "sample",
  originalFilename: "sample.mp3",
  mimeType: "audio/mpeg",
  durationMs: 2000,
  sampleRate: 44_100,
  channels: 2,
  byteSize: 100,
  createdAt,
  updatedAt: createdAt,
};

const originalVersion = {
  id: "audio_version_1",
  version: 1,
  source: "original" as const,
  storageKey: "",
  mimeType: "audio/mpeg",
  durationMs: 2000,
  sampleRate: 44_100,
  channels: 2,
  byteSize: 100,
  operations: null,
  createdAt,
};

const mergedAssetRecord = {
  ...assetRecord,
  id: "audio_456",
  name: "second clip",
  originalFilename: "second.mp3",
  durationMs: 1000,
};

const mergedVersion = {
  ...originalVersion,
  id: "audio_version_2",
  assetId: "audio_456",
  storageKey: "",
  durationMs: 1000,
};

const operations: AudioOperations = {
  trim: { startMs: 0, endMs: 1000 },
  speed: 2,
  mergeAssetIds: [],
};

let sampleBuffer: Buffer;
let secondBuffer: Buffer;
let shortBuffer: Buffer;
let fixtureDirectory: string;

function generateMp3(
  filename: string,
  durationSeconds: number,
  frequency: number,
): Buffer {
  const outputPath = path.join(fixtureDirectory, filename);

  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${frequency}:duration=${durationSeconds}:sample_rate=44100`,
      "-ac",
      "2",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outputPath,
    ],
    { stdio: "ignore" },
  );

  return readFileSync(outputPath);
}

beforeAll(() => {
  fixtureDirectory = mkdtempSync(
    path.join(tmpdir(), "editflow-studio-audio-fixtures-"),
  );
  sampleBuffer = generateMp3("sample.mp3", 2, 440);
  secondBuffer = generateMp3("second.mp3", 1, 660);
  shortBuffer = generateMp3("short.mp3", 0.2, 880);
});

afterAll(() => {
  rmSync(fixtureDirectory, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findFirst.mockResolvedValue(ownedProject);
  prismaMock.audioAsset.update.mockResolvedValue({ id: "audio_123" });
  prismaMock.audioAsset.delete.mockResolvedValue({ id: "audio_123" });
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

async function storedOriginal(buffer = sampleBuffer): Promise<string> {
  const stored = await saveAudioFile(
    "project_123",
    "audio_123",
    buffer,
    "mp3",
  );
  return stored.storageKey;
}

describe("audio API", () => {
  it("requires authentication", async () => {
    const listResponse = await request(app).get(
      "/api/projects/project_123/audio",
    );
    const uploadResponse = await request(app)
      .post("/api/projects/project_123/audio")
      .attach("audio", sampleBuffer, {
        filename: "sample.mp3",
        contentType: "audio/mpeg",
      });

    expect(listResponse.status).toBe(401);
    expect(uploadResponse.status).toBe(401);
    expect(prismaMock.audioAsset.findMany).not.toHaveBeenCalled();
  });

  it("uploads valid audio, probes its duration, and preserves the original", async () => {
    prismaMock.audioAsset.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...assetRecord,
        ...data,
        createdAt,
        updatedAt: createdAt,
      }),
    );
    prismaMock.audioVersion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: "audio_version_1",
        createdAt,
      }),
    );
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio")
      .attach("audio", sampleBuffer, {
        filename: "sample.mp3",
        contentType: "audio/mpeg",
      });

    expect(response.status).toBe(201);
    expect(response.body.audio).toMatchObject({
      projectId: "project_123",
      name: "sample",
      originalFilename: "sample.mp3",
      mimeType: "audio/mpeg",
      sampleRate: 44_100,
      channels: 2,
      versionCount: 1,
    });
    expect(response.body.audio.durationMs).toBeGreaterThan(1_900);
    expect(response.body.audio.durationMs).toBeLessThan(2_200);
    expect(response.body.audio.originalVersion).toMatchObject({
      version: 1,
      source: "original",
    });
    expect(response.body.audio.originalVersion).not.toHaveProperty(
      "storageKey",
    );
    expect(prismaMock.audioAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project_123",
          name: "sample",
          mimeType: "audio/mpeg",
        }),
      }),
    );

    const versionData = prismaMock.audioVersion.create.mock.calls[0]?.[0]?.data;
    expect(versionData).toMatchObject({
      version: 1,
      source: "original",
      mimeType: "audio/mpeg",
    });
    expect(await readAudioFile(versionData.storageKey)).toEqual(sampleBuffer);
  });

  it("rejects missing, unsupported, invalid, and too-short audio uploads", async () => {
    const agent = await loginAgent();

    const missingResponse = await agent.post(
      "/api/projects/project_123/audio",
    );
    const unsupportedResponse = await agent
      .post("/api/projects/project_123/audio")
      .attach("audio", sampleBuffer, {
        filename: "sample.txt",
        contentType: "text/plain",
      });
    const invalidResponse = await agent
      .post("/api/projects/project_123/audio")
      .attach("audio", Buffer.from("this is not audio"), {
        filename: "fake.mp3",
        contentType: "audio/mpeg",
      });
    const shortResponse = await agent
      .post("/api/projects/project_123/audio")
      .attach("audio", shortBuffer, {
        filename: "short.mp3",
        contentType: "audio/mpeg",
      });

    expect(missingResponse.status).toBe(400);
    expect(missingResponse.body.fields.audio).toBeDefined();
    expect(unsupportedResponse.status).toBe(400);
    expect(unsupportedResponse.body.fields.audio).toContain("MP3");
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.fields.audio).toContain("valid");
    expect(shortResponse.status).toBe(400);
    expect(shortResponse.body.fields.audio).toContain("0.5 seconds");
    expect(prismaMock.audioAsset.create).not.toHaveBeenCalled();
  });

  it("rejects uploads larger than the configured limit", async () => {
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio")
      .attach("audio", Buffer.alloc(MAX_AUDIO_BYTES + 1, 1), {
        filename: "huge.mp3",
        contentType: "audio/mpeg",
      });

    expect(response.status).toBe(413);
    expect(response.body.fields.audio).toContain("25 MB");
  });

  it("lists only audio in the owned project", async () => {
    prismaMock.audioAsset.findMany.mockResolvedValueOnce([
      { ...assetRecord, versions: [originalVersion] },
    ]);
    const agent = await loginAgent();

    const response = await agent.get("/api/projects/project_123/audio");

    expect(response.status).toBe(200);
    expect(response.body.audio[0]).toMatchObject({
      id: "audio_123",
      name: "sample",
      durationMs: 2000,
      versionCount: 1,
      latestVersion: { version: 1, source: "original" },
    });
    expect(response.body.audio[0]).not.toHaveProperty("versions");
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: { id: "project_123", ownerId: publicUser.id },
      select: { id: true, name: true },
    });
  });

  it("returns audio details with ordered version metadata", async () => {
    const editedVersion = {
      ...originalVersion,
      id: "audio_version_2",
      version: 2,
      source: "edited" as const,
      operations,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    };
    prismaMock.audioAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [originalVersion, editedVersion],
    });
    const agent = await loginAgent();

    const response = await agent.get(
      "/api/projects/project_123/audio/audio_123",
    );

    expect(response.status).toBe(200);
    expect(response.body.audio.versionCount).toBe(2);
    expect(response.body.audio.latestVersion).toMatchObject({
      id: "audio_version_2",
      version: 2,
      source: "edited",
      operations,
    });
    expect(
      response.body.audio.versions.map(
        (version: { version: number }) => version.version,
      ),
    ).toEqual([2, 1]);
  });

  it("renders a preview with trim and speed applied", async () => {
    const storageKey = await storedOriginal();
    prismaMock.audioAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey }],
    });
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio/audio_123/preview")
      .send({ operations });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("audio/mpeg");
    expect(response.body.byteLength).toBeGreaterThan(1_000);
  });

  it("merges selected clips in order and then applies the trim", async () => {
    const primaryKey = await storedOriginal();
    const secondKey = await saveAudioFile(
      "project_123",
      "audio_456",
      secondBuffer,
      "mp3",
    );
    prismaMock.audioAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey: primaryKey }],
    });
    prismaMock.audioAsset.findMany.mockResolvedValueOnce([
      {
        ...mergedAssetRecord,
        versions: [{ ...mergedVersion, storageKey: secondKey.storageKey }],
      },
    ]);
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio/audio_123/preview")
      .send({
        operations: {
          trim: { startMs: 0, endMs: 2000 },
          speed: 1,
          mergeAssetIds: ["audio_456"],
        },
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("audio/mpeg");
    expect(response.body.byteLength).toBeGreaterThan(4_000);
    expect(prismaMock.audioAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["audio_456"] },
          projectId: "project_123",
        },
      }),
    );
  });

  it("validates processing parameters before touching audio", async () => {
    const agent = await loginAgent();

    const speedResponse = await agent
      .post("/api/projects/project_123/audio/audio_123/preview")
      .send({
        operations: {
          ...operations,
          speed: 4,
        },
      });
    const trimResponse = await agent
      .post("/api/projects/project_123/audio/audio_123/preview")
      .send({
        operations: {
          ...operations,
          trim: { startMs: 1500, endMs: 1000 },
        },
      });
    const duplicateMergeResponse = await agent
      .post("/api/projects/project_123/audio/audio_123/preview")
      .send({
        operations: {
          ...operations,
          mergeAssetIds: ["audio_456", "audio_456"],
        },
      });

    expect(speedResponse.status).toBe(400);
    expect(speedResponse.body.fields["operations.speed"]).toBeDefined();
    expect(trimResponse.status).toBe(400);
    expect(
      trimResponse.body.fields["operations.trim.endMs"],
    ).toBeDefined();
    expect(duplicateMergeResponse.status).toBe(400);
    expect(
      duplicateMergeResponse.body.fields["operations.mergeAssetIds"],
    ).toBeDefined();
    expect(prismaMock.audioAsset.findFirst).not.toHaveBeenCalled();
  });

  it("hides audio and files for projects the user does not own", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    const agent = await loginAgent();

    const detailResponse = await agent.get(
      "/api/projects/not_owned/audio/audio_123",
    );
    const previewResponse = await agent
      .post("/api/projects/not_owned/audio/audio_123/preview")
      .send({ operations });

    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body.error).toBe("Project not found.");
    expect(previewResponse.status).toBe(404);
    expect(prismaMock.audioAsset.findFirst).not.toHaveBeenCalled();
  });

  it("appends a processed edited version without overwriting the original", async () => {
    const storageKey = await storedOriginal();
    prismaMock.audioAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey }],
    });
    prismaMock.audioVersion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: "audio_version_2",
        createdAt,
      }),
    );
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio/audio_123/versions")
      .send({ operations });

    expect(response.status).toBe(201);
    expect(response.body.version).toMatchObject({
      id: "audio_version_2",
      version: 2,
      source: "edited",
      mimeType: "audio/mpeg",
      operations,
    });
    expect(response.body.version.durationMs).toBeGreaterThan(400);
    expect(response.body.version.durationMs).toBeLessThan(700);
    expect(prismaMock.audioVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetId: "audio_123",
          version: 2,
          source: "edited",
          operations,
        }),
      }),
    );

    const versionData = prismaMock.audioVersion.create.mock.calls[0]?.[0]?.data;
    const savedBuffer = await readAudioFile(versionData.storageKey);
    expect(savedBuffer.byteLength).toBeGreaterThan(1_000);
    expect(prismaMock.audioAsset.update).toHaveBeenCalled();
  });

  it("increments the version number from the latest saved edit", async () => {
    const storageKey = await storedOriginal();
    prismaMock.audioAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [
        {
          ...originalVersion,
          id: "audio_version_2",
          version: 2,
          source: "edited" as const,
          storageKey,
          operations,
        },
        { ...originalVersion, storageKey },
      ],
    });
    prismaMock.audioVersion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: "audio_version_3",
        createdAt,
      }),
    );
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio/audio_123/versions")
      .send({ operations });

    expect(response.status).toBe(201);
    expect(response.body.version.version).toBe(3);
  });

  it("exports the current edit as a downloadable MP3", async () => {
    const storageKey = await storedOriginal();
    prismaMock.audioAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey }],
    });
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/audio/audio_123/export")
      .send({ operations });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("audio/mpeg");
    expect(String(response.headers["content-disposition"])).toContain(
      "attachment",
    );
    expect(String(response.headers["content-disposition"])).toContain(
      "sample.mp3",
    );
    expect(response.body.byteLength).toBeGreaterThan(1_000);
  });

  it("serves original and saved versions with byte-range support", async () => {
    const storageKey = await storedOriginal();
    const edited = await saveAudioFile(
      "project_123",
      "audio_123",
      secondBuffer,
      "mp3",
    );
    prismaMock.audioAsset.findFirst.mockResolvedValue({
      ...assetRecord,
      versions: [
        {
          ...originalVersion,
          id: "audio_version_2",
          version: 2,
          source: "edited" as const,
          storageKey: edited.storageKey,
          durationMs: 1000,
        },
        { ...originalVersion, storageKey },
      ],
    });
    const agent = await loginAgent();

    const originalResponse = await agent.get(
      "/api/projects/project_123/audio/audio_123/file",
    );
    const rangeResponse = await agent
      .get("/api/projects/project_123/audio/audio_123/file")
      .set("Range", "bytes=0-99");
    const versionResponse = await agent.get(
      "/api/projects/project_123/audio/audio_123/versions/audio_version_2/file?download=1",
    );
    const missingResponse = await agent.get(
      "/api/projects/project_123/audio/audio_123/versions/missing/file",
    );

    expect(originalResponse.status).toBe(200);
    expect(originalResponse.headers["content-type"]).toBe("audio/mpeg");
    expect(originalResponse.headers["accept-ranges"]).toBe("bytes");
    expect(originalResponse.body).toEqual(sampleBuffer);

    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers["content-range"]).toBe(
      `bytes 0-99/${sampleBuffer.byteLength}`,
    );
    expect(rangeResponse.body.byteLength).toBe(100);

    expect(versionResponse.status).toBe(200);
    expect(String(versionResponse.headers["content-disposition"])).toContain(
      "attachment",
    );
    expect(versionResponse.body.byteLength).toBe(secondBuffer.byteLength);

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toBe("Audio version not found.");
  });
});
