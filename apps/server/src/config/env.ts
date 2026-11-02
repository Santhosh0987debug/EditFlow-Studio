import { existsSync } from "node:fs";
import path from "node:path";

// One optional .env at the repository root keeps the workspace configuration together.
const rootEnvPath = path.resolve(__dirname, "../../../../.env");

if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

function readPort(rawPort: string | undefined): number {
  const port = Number(rawPort ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT must be an integer between 1 and 65535. Received: ${rawPort}`,
    );
  }

  return port;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readJwtSecret(): string {
  const secret = requireEnv("JWT_SECRET");

  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  return secret;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const env = {
  port: readPort(process.env.PORT),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: readJwtSecret(),
  nodeEnv,
  isProduction: nodeEnv === "production",
  sessionCookieName: "editflow_session",
  sessionDurationMs,
  aiProvider: readOptionalEnv("AI_PROVIDER"),
  aiApiKey: readOptionalEnv("AI_API_KEY"),
  aiModel: readOptionalEnv("AI_MODEL"),
  aiBaseUrl: readOptionalEnv("AI_BASE_URL") ?? "https://api.openai.com/v1",
} as const;
