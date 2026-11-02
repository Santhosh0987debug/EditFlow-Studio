import type {
  SaveTextVersionResponse,
  TextDocumentResponse,
  TextVersionListResponse,
  TextVersionResponse,
} from "@editflow/shared";
import { Router } from "express";
import { getUserId, parseBody } from "../../lib/validation";
import { requireAuth } from "../../middleware/require-auth";
import { saveTextVersionSchema } from "./text.schemas";
import {
  getTextDocument,
  getTextVersion,
  listTextVersions,
  saveTextVersion,
} from "./text.service";

export const textRouter = Router({ mergeParams: true });

textRouter.use(requireAuth);

function readProjectId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Text routes require a projectId path parameter.");
  }

  return value;
}

textRouter.get("/", async (request, response) => {
  const document = await getTextDocument(
    getUserId(request),
    readProjectId((request.params as Record<string, unknown>).projectId),
  );

  const payload: TextDocumentResponse = { document };
  response.status(200).json(payload);
});

textRouter.post("/versions", async (request, response) => {
  const input = parseBody(saveTextVersionSchema, request.body);
  const result = await saveTextVersion(
    getUserId(request),
    readProjectId((request.params as Record<string, unknown>).projectId),
    input,
  );

  const payload: SaveTextVersionResponse = result;
  response.status(201).json(payload);
});

textRouter.get("/versions", async (request, response) => {
  const versions = await listTextVersions(
    getUserId(request),
    readProjectId((request.params as Record<string, unknown>).projectId),
  );

  const payload: TextVersionListResponse = { versions };
  response.status(200).json(payload);
});

textRouter.get("/versions/:versionId", async (request, response) => {
  const versionId = request.params.versionId;

  if (typeof versionId !== "string" || versionId.length === 0) {
    response.status(404).json({ error: "Version not found." });
    return;
  }

  const version = await getTextVersion(
    getUserId(request),
    readProjectId((request.params as Record<string, unknown>).projectId),
    versionId,
  );

  const payload: TextVersionResponse = { version };
  response.status(200).json(payload);
});
