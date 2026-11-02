import { z } from "zod";
import { AppError } from "../../../lib/app-error";

const openAiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().min(1),
        }),
      }),
    )
    .min(1),
});

export type OpenAiCompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type TextGenerationProvider = {
  readonly name: string;
  readonly model: string;
  generate(prompt: {
    system: string;
    user: string;
  }): Promise<string>;
};

type FetchImplementation = typeof fetch;

/**
 * Minimal OpenAI-compatible chat completions client. The provider is
 * responsible only for the transport and envelope validation; prompt design
 * and structured output validation live in ai.service.ts.
 */
export class OpenAiCompatibleProvider implements TextGenerationProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchImplementation;

  constructor(
    config: OpenAiCompatibleConfig,
    fetchImpl: FetchImplementation = fetch,
  ) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.model = config.model;
    this.fetchImpl = fetchImpl;
  }

  async generate(prompt: {
    system: string;
    user: string;
  }): Promise<string> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AppError(
          504,
          "The AI provider took too long to respond. Please try again.",
        );
      }

      throw new AppError(
        502,
        "The AI provider could not be reached. Please try again.",
      );
    }

    if (!response.ok) {
      // Never log response bodies or credentials from the provider.
      console.error(
        `AI provider request failed with status ${response.status}.`,
      );
      throw new AppError(
        502,
        "The AI provider could not complete the request. Please try again.",
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new AppError(
        502,
        "The AI provider returned an unreadable response.",
      );
    }

    const parsed = openAiResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AppError(
        502,
        "The AI provider returned an unrecognized response.",
      );
    }

    return parsed.data.choices[0]!.message.content;
  }
}
