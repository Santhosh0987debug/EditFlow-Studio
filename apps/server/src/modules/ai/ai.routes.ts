import type { AiStatusResponse, AiTextResponse } from "@editflow/shared";
import { Router } from "express";
import { parseBody } from "../../lib/validation";
import { requireAuth } from "../../middleware/require-auth";
import { getAiStatus } from "./ai.provider";
import { aiTextRequestSchema } from "./ai.schemas";
import { generateTextProposal } from "./ai.service";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.get("/status", (_request, response) => {
  const payload: AiStatusResponse = getAiStatus();
  response.status(200).json(payload);
});

aiRouter.post("/generate", async (request, response) => {
  const input = parseBody(aiTextRequestSchema, request.body);
  const proposal = await generateTextProposal(input);

  const payload: AiTextResponse = { proposal };
  response.status(200).json(payload);
});
