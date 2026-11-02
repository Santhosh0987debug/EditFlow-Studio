import type { AiStatusResponse } from "@editflow/shared";
import { env } from "../../config/env";
import {
  OpenAiCompatibleProvider,
  type TextGenerationProvider,
} from "./providers/openai-compatible.provider";

export type { TextGenerationProvider };

const CONFIGURATION_HINT =
  "Set AI_PROVIDER=openai-compatible, AI_API_KEY, and AI_MODEL on the server to enable AI editing.";

export function getAiStatus(): AiStatusResponse {
  if (!env.aiProvider) {
    return {
      configured: false,
      provider: null,
      model: null,
      message: `AI editing is not configured. ${CONFIGURATION_HINT}`,
    };
  }

  if (env.aiProvider !== "openai-compatible") {
    return {
      configured: false,
      provider: env.aiProvider,
      model: env.aiModel,
      message: `Unsupported AI_PROVIDER "${env.aiProvider}". Set AI_PROVIDER=openai-compatible.`,
    };
  }

  if (!env.aiApiKey) {
    return {
      configured: false,
      provider: env.aiProvider,
      model: env.aiModel,
      message: `AI editing is missing AI_API_KEY. ${CONFIGURATION_HINT}`,
    };
  }

  if (!env.aiModel) {
    return {
      configured: false,
      provider: env.aiProvider,
      model: null,
      message: `AI editing is missing AI_MODEL. ${CONFIGURATION_HINT}`,
    };
  }

  return {
    configured: true,
    provider: env.aiProvider,
    model: env.aiModel,
    message: `AI editing is configured with ${env.aiProvider} (${env.aiModel}).`,
  };
}

export function getTextGenerationProvider(): TextGenerationProvider | null {
  if (!getAiStatus().configured) {
    return null;
  }

  return new OpenAiCompatibleProvider({
    apiKey: env.aiApiKey!,
    baseUrl: env.aiBaseUrl,
    model: env.aiModel!,
  });
}
