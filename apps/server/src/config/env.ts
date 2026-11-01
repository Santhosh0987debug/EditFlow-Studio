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

export const env = {
  port: readPort(process.env.PORT),
};
