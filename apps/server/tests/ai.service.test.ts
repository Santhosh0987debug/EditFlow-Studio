import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/app-error";
import type { TextGenerationProvider } from "../src/modules/ai/ai.provider";
import { generateTextProposal } from "../src/modules/ai/ai.service";

const input = {
  action: "tone" as const,
  content: "Our new release is available now.",
  tone: "friendly",
};

function providerReturning(raw: string): TextGenerationProvider {
  return {
    name: "test-provider",
    model: "test-model",
    generate: vi.fn().mockResolvedValue(raw),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AI text generation service", () => {
  it("returns a validated structured proposal and forwards the prompt", async () => {
    const provider = providerReturning(
      JSON.stringify({
        text: "Our new release is ready for you to try.",
        notes: ["Made the tone friendlier."],
      }),
    );

    const result = await generateTextProposal(input, provider);

    expect(result).toEqual({
      text: "Our new release is ready for you to try.",
      notes: ["Made the tone friendlier."],
      action: "tone",
      provider: "test-provider",
      model: "test-model",
    });
    expect(provider.generate).toHaveBeenCalledWith({
      system: expect.stringContaining("JSON"),
      user: expect.stringContaining("TARGET TONE: friendly"),
    });
  });

  it("accepts JSON wrapped in a code fence", async () => {
    const provider = providerReturning(
      '```json\n{"text":"Fenced output","notes":["Parsed fences."]}\n```',
    );

    const result = await generateTextProposal(
      { action: "rewrite", content: "Original" },
      provider,
    );

    expect(result.text).toBe("Fenced output");
  });

  it("rejects malformed JSON without returning a fake success", async () => {
    const provider = providerReturning("not json at all");

    await expect(
      generateTextProposal({ action: "rewrite", content: "Original" }, provider),
    ).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("invalid structured response"),
    });
  });

  it("rejects output that does not match the proposal schema", async () => {
    const provider = providerReturning(
      JSON.stringify({ text: "", notes: [] }),
    );

    await expect(
      generateTextProposal(
        { action: "summarize", content: "Original" },
        provider,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("maps provider failures to a clean upstream error", async () => {
    const provider: TextGenerationProvider = {
      name: "test-provider",
      model: "test-model",
      generate: vi.fn().mockRejectedValue(new Error("socket closed")),
    };

    await expect(
      generateTextProposal(
        { action: "expand", content: "Original" },
        provider,
      ),
    ).rejects.toMatchObject({
      status: 502,
      message: "The AI provider failed before returning a proposal. Please try again.",
    });
  });

  it("refuses to generate when no provider is configured", async () => {
    await expect(
      generateTextProposal(
        { action: "grammar", content: "Original" },
        null,
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("AI editing is not configured"),
    });
  });
});
