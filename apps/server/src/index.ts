import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function start(): Promise<void> {
  await prisma.$connect();

  const server = app.listen(env.port, () => {
    console.log(`EditFlow Studio API listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`${signal} received. Shutting down.`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch(async (error: unknown) => {
  console.error("Failed to start the EditFlow Studio API.", error);
  await prisma.$disconnect();
  process.exit(1);
});
