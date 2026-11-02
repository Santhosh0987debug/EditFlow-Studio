import cookieParser from "cookie-parser";
import express from "express";
import type { HealthResponse } from "@editflow/shared";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { aiRouter } from "./modules/ai/ai.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { projectsRouter } from "./modules/projects/project.routes";
import { textRouter } from "./modules/text/text.routes";

export const app = express();

// Keep the framework fingerprint out of API responses.
app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Session and project responses must not be cached by browsers or proxies.
app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_request, response) => {
  const payload: HealthResponse = {
    status: "ok",
    service: "editflow-studio-api",
    timestamp: new Date().toISOString(),
  };

  response.status(200).json(payload);
});

app.use("/api/auth", authRouter);
app.use("/api/ai", aiRouter);
app.use("/api/projects/:projectId/text", textRouter);
app.use("/api/projects", projectsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
