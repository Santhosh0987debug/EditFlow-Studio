import { MAX_IMAGE_BYTES } from "@editflow/shared";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  imageAsset: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  imageVersion: {
    create: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { app } from "../src/app";
import {
  readImageFile,
  saveImageFile,
} from "../src/modules/images/image.storage";

const createdAt = new Date("2026-01-01T09:00:00.000Z");

const publicUser = {
  id: "user_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  createdAt,
};

const ownedProject = { id: "project_123", name: "Launch teaser" };

const assetRecord = {
  id: "asset_123",
  projectId: "project_123",
  name: "sample",
  originalFilename: "sample.png",
  mimeType: "image/png",
  width: 120,
  height: 80,
  byteSize: 100,
  createdAt,
  updatedAt: createdAt,
};

const originalVersion = {
  id: "version_1",
  version: 1,
  source: "original" as const,
  storageKey: "",
  mimeType: "image/png",
  width: 120,
  height: 80,
  byteSize: 100,
  operations: null,
  createdAt,
};

const operations = {
  brightness: 10,
  contrast: -5,
  saturation: 20,
  filter: "grayscale" as const,
  crop: { left: 0, top: 0, width: 50, height: 100 },
  resize: { width: 30, height: null },
};

let pngBuffer: Buffer;

beforeAll(async () => {
  pngBuffer = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findFirst.mockResolvedValue(ownedProject);
  prismaMock.imageAsset.update.mockResolvedValue({ id: "asset_123" });
  prismaMock.imageAsset.delete.mockResolvedValue({ id: "asset_123" });
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

async function storedOriginal(): Promise<string> {
  const stored = await saveImageFile(
    "project_123",
    "asset_123",
    pngBuffer,
    "png",
  );
  return stored.storageKey;
}

async function storeConverted(
  data: Buffer,
  extension: string,
): Promise<string> {
  const stored = await saveImageFile("project_123", "asset_123", data, extension);
  return stored.storageKey;
}

describe("image API", () => {
  it("requires authentication", async () => {
    const listResponse = await request(app).get(
      "/api/projects/project_123/images",
    );
    const uploadResponse = await request(app)
      .post("/api/projects/project_123/images")
      .attach("image", pngBuffer, {
        filename: "sample.png",
        contentType: "image/png",
      });

    expect(listResponse.status).toBe(401);
    expect(uploadResponse.status).toBe(401);
    expect(prismaMock.imageAsset.findMany).not.toHaveBeenCalled();
  });

  it("uploads a valid image, preserves the original, and returns metadata", async () => {
    prismaMock.imageAsset.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...assetRecord,
        ...data,
        createdAt,
        updatedAt: createdAt,
      }),
    );
    prismaMock.imageVersion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: "version_1",
        createdAt,
      }),
    );
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images")
      .attach("image", pngBuffer, {
        filename: "sample.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.image).toMatchObject({
      projectId: "project_123",
      name: "sample",
      originalFilename: "sample.png",
      mimeType: "image/png",
      width: 120,
      height: 80,
      versionCount: 1,
    });
    expect(response.body.image.originalVersion).toMatchObject({
      version: 1,
      source: "original",
      width: 120,
      height: 80,
    });
    expect(response.body.image.originalVersion).not.toHaveProperty("storageKey");
    expect(prismaMock.imageAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project_123",
          name: "sample",
          mimeType: "image/png",
        }),
      }),
    );

    const versionData = prismaMock.imageVersion.create.mock.calls[0]?.[0]?.data;
    expect(versionData).toMatchObject({
      version: 1,
      source: "original",
      mimeType: "image/png",
    });
    expect(await readImageFile(versionData.storageKey)).toEqual(pngBuffer);
  });

  it("rejects missing, unsupported, and invalid image uploads", async () => {
    const agent = await loginAgent();

    const missingResponse = await agent.post(
      "/api/projects/project_123/images",
    );
    const unsupportedResponse = await agent
      .post("/api/projects/project_123/images")
      .attach("image", pngBuffer, {
        filename: "sample.txt",
        contentType: "text/plain",
      });
    const invalidResponse = await agent
      .post("/api/projects/project_123/images")
      .attach("image", Buffer.from("this is not an image"), {
        filename: "fake.png",
        contentType: "image/png",
      });

    expect(missingResponse.status).toBe(400);
    expect(missingResponse.body.fields.image).toBeDefined();
    expect(unsupportedResponse.status).toBe(400);
    expect(unsupportedResponse.body.fields.image).toContain("JPEG");
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.fields.image).toContain("valid");
    expect(prismaMock.imageAsset.create).not.toHaveBeenCalled();
  });

  it("rejects uploads larger than the configured limit", async () => {
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images")
      .attach("image", Buffer.alloc(MAX_IMAGE_BYTES + 1, 1), {
        filename: "huge.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(413);
    expect(response.body.fields.image).toContain("10 MB");
  });

  it("lists only images in the owned project", async () => {
    prismaMock.imageAsset.findMany.mockResolvedValueOnce([
      { ...assetRecord, versions: [originalVersion] },
    ]);
    const agent = await loginAgent();

    const response = await agent.get("/api/projects/project_123/images");

    expect(response.status).toBe(200);
    expect(response.body.images[0]).toMatchObject({
      id: "asset_123",
      name: "sample",
      versionCount: 1,
      latestVersion: { version: 1, source: "original" },
    });
    expect(response.body.images[0]).not.toHaveProperty("versions");
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: { id: "project_123", ownerId: publicUser.id },
      select: { id: true, name: true },
    });
  });

  it("returns image details with ordered version metadata", async () => {
    const editedVersion = {
      ...originalVersion,
      id: "version_2",
      version: 2,
      source: "edited" as const,
      operations,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    };
    prismaMock.imageAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [originalVersion, editedVersion],
    });
    const agent = await loginAgent();

    const response = await agent.get("/api/projects/project_123/images/asset_123");

    expect(response.status).toBe(200);
    expect(response.body.image.versionCount).toBe(2);
    expect(response.body.image.latestVersion).toMatchObject({
      id: "version_2",
      version: 2,
      source: "edited",
      operations,
    });
    expect(response.body.image.versions.map((version: { version: number }) => version.version)).toEqual([
      2, 1,
    ]);
  });

  it("renders a preview with crop, color, filter, and resize operations", async () => {
    const storageKey = await storedOriginal();
    prismaMock.imageAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey }],
    });
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images/asset_123/preview")
      .send({ operations });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/webp");

    const metadata = await sharp(response.body as Buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(30);
    expect(metadata.height).toBe(40);
  });

  it("validates processing parameters before touching the image", async () => {
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images/asset_123/preview")
      .send({
        operations: {
          ...operations,
          brightness: 250,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.fields["operations.brightness"]).toBeDefined();
    expect(prismaMock.imageAsset.findFirst).not.toHaveBeenCalled();
  });

  it("hides images and files for projects the user does not own", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    const agent = await loginAgent();

    const detailResponse = await agent.get(
      "/api/projects/not_owned/images/asset_123",
    );
    const previewResponse = await agent
      .post("/api/projects/not_owned/images/asset_123/preview")
      .send({ operations });

    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body.error).toBe("Project not found.");
    expect(previewResponse.status).toBe(404);
    expect(prismaMock.imageAsset.findFirst).not.toHaveBeenCalled();
  });

  it("appends a processed edited version without overwriting the original", async () => {
    const storageKey = await storedOriginal();
    prismaMock.imageAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey }],
    });
    prismaMock.imageVersion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: "version_2",
        createdAt,
      }),
    );
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images/asset_123/versions")
      .send({ operations });

    expect(response.status).toBe(201);
    expect(response.body.version).toMatchObject({
      id: "version_2",
      version: 2,
      source: "edited",
      width: 30,
      height: 40,
      operations,
    });
    expect(prismaMock.imageVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetId: "asset_123",
          version: 2,
          source: "edited",
          operations,
        }),
      }),
    );

    const versionData = prismaMock.imageVersion.create.mock.calls[0]?.[0]?.data;
    const savedBuffer = await readImageFile(versionData.storageKey);
    const metadata = await sharp(savedBuffer).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(30);
    expect(metadata.height).toBe(40);
    expect(prismaMock.imageAsset.update).toHaveBeenCalled();
  });

  it("increments the version number from the latest saved edit", async () => {
    const storageKey = await storedOriginal();
    prismaMock.imageAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [
        {
          ...originalVersion,
          id: "version_2",
          version: 2,
          source: "edited" as const,
          storageKey,
          operations,
        },
        { ...originalVersion, storageKey },
      ],
    });
    prismaMock.imageVersion.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: "version_3",
        createdAt,
      }),
    );
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images/asset_123/versions")
      .send({ operations });

    expect(response.status).toBe(201);
    expect(response.body.version.version).toBe(3);
  });

  it("exports the current edit as a downloadable image", async () => {
    const storageKey = await storedOriginal();
    prismaMock.imageAsset.findFirst.mockResolvedValueOnce({
      ...assetRecord,
      versions: [{ ...originalVersion, storageKey }],
    });
    const agent = await loginAgent();

    const response = await agent
      .post("/api/projects/project_123/images/asset_123/export")
      .send({ operations });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(String(response.headers["content-disposition"])).toContain(
      "attachment",
    );
    expect(String(response.headers["content-disposition"])).toContain(
      "sample.png",
    );

    const metadata = await sharp(response.body as Buffer).metadata();
    expect(metadata.width).toBe(30);
    expect(metadata.height).toBe(40);
  });

  it("serves original and saved version files with download support", async () => {
    const storageKey = await storedOriginal();
    const converted = await sharp(pngBuffer)
      .resize({ width: 40 })
      .png()
      .toBuffer();
    const editedStorageKey = await storeConverted(converted, "png");
    prismaMock.imageAsset.findFirst.mockResolvedValue({
      ...assetRecord,
      versions: [
        {
          ...originalVersion,
          id: "version_2",
          version: 2,
          source: "edited" as const,
          storageKey: editedStorageKey,
          width: 40,
          height: 27,
        },
        { ...originalVersion, storageKey },
      ],
    });
    const agent = await loginAgent();

    const originalResponse = await agent.get(
      "/api/projects/project_123/images/asset_123/file",
    );
    const versionResponse = await agent.get(
      "/api/projects/project_123/images/asset_123/versions/version_2/file?download=1",
    );
    const missingResponse = await agent.get(
      "/api/projects/project_123/images/asset_123/versions/missing/file",
    );

    expect(originalResponse.status).toBe(200);
    expect(originalResponse.headers["content-type"]).toBe("image/png");
    expect(await sharp(originalResponse.body as Buffer).metadata()).toMatchObject({
      width: 120,
      height: 80,
    });

    expect(versionResponse.status).toBe(200);
    expect(String(versionResponse.headers["content-disposition"])).toContain(
      "attachment",
    );
    expect(await sharp(versionResponse.body as Buffer).metadata()).toMatchObject({
      width: 40,
    });

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toBe("Image version not found.");
  });
});
