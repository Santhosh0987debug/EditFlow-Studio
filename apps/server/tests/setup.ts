import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/editflow_studio_test?schema=public";
process.env.JWT_SECRET =
  "test-only-secret-that-is-longer-than-thirty-two-characters";

const imageStorageDir = mkdtempSync(
  path.join(os.tmpdir(), "editflow-studio-images-"),
);
process.env.IMAGE_STORAGE_DIR = imageStorageDir;

const audioStorageDir = mkdtempSync(
  path.join(os.tmpdir(), "editflow-studio-audio-"),
);
process.env.AUDIO_STORAGE_DIR = audioStorageDir;

afterAll(() => {
  rmSync(imageStorageDir, { recursive: true, force: true });
  rmSync(audioStorageDir, { recursive: true, force: true });
});

// Keep AI tests deterministic even when the developer's .env configures a
// provider for the running app.
delete process.env.AI_PROVIDER;
delete process.env.AI_API_KEY;
delete process.env.AI_MODEL;
delete process.env.AI_BASE_URL;
