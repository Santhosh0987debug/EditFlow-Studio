import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "../src/modules/ai/providers/openai-compatible.provider";

const config = {
  apiKey: "test-api-key",
  baseUrl: "https://provider.example/v1/",
  model: "test-model",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAI-compatible provider", () => {
  it("sends a chat completion request and returns the message content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"text":"ok"}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = new OpenAiCompatibleProvider(
      config,
      fetchImpl as unknown as typeof fetch,
    );

    const result = await provider.generate({
      system: "system prompt",
      user: "user prompt",
    });

    expect(result).toBe('{"text":"ok"}');
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      }),
    );
    expect(provider.name).toBe("openai-compatible");
    expect(provider.model).toBe("test-model");
  });

  it("rejects a non-success provider response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = new OpenAiCompatibleProvider(
      config,
      vi.fn().mockResolvedValue(
        new Response("upstream error", { status: 500 }),
      ) as unknown as typeof fetch,
    );

    await expect(
      provider.generate({ system: "system", user: "user" }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("rejects an unrecognized provider envelope", async () => {
    const provider = new OpenAiCompatibleProvider(
      config,
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      ) as unknown as typeof fetch,
    );

    await expect(
      provider.generate({ system: "system", user: "user" }),
    ).rejects.toMatchObject({
      status: 502,
      message: "The AI provider returned an unrecognized response.",
    });
  });

  it("reports provider timeouts distinctly", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";

    const provider = new OpenAiCompatibleProvider(
      config,
      vi.fn().mockRejectedValue(timeout) as unknown as typeof fetch,
    );

    await expect(
      provider.generate({ system: "system", user: "user" }),
    ).rejects.toMatchObject({ status: 504 });
  });
});
