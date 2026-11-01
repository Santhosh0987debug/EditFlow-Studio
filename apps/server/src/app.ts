import express from "express";
import type { ApiErrorResponse, HealthResponse } from "@editflow/shared";

export const app = express();

// Keep the framework fingerprint out of API responses.
app.disable("x-powered-by");

app.get("/api/health", (_request, response) => {
  const payload: HealthResponse = {
    status: "ok",
    service: "editflow-studio-api",
    timestamp: new Date().toISOString(),
  };

  response.status(200).json(payload);
});

app.use((_request, response) => {
  const payload: ApiErrorResponse = { error: "Not found" };
  response.status(404).json(payload);
});
