import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async ({ model }: { model?: string }) => ({
    id: "test-response",
    created: 0,
    model: model ?? "gpt-5-mini",
    choices: [{ index: 0, message: { role: "assistant", content: "A grounded test response." }, finish_reason: "stop" }],
    usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
  })),
  listLLMModels: vi.fn(async () => ({
    data: [
      { id: "gpt-5-mini" },
      { id: "claude-sonnet-4-6" },
    ],
  })),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const createContext = (): TrpcContext => ({
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("chat router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes discovered model choices for the selector", async () => {
    const result = await appRouter.createCaller(createContext()).chat.models();
    expect(result.map(model => model.id)).toEqual(["auto", "gpt-5-mini", "claude-sonnet-4-6"]);
    expect(result[0]).toMatchObject({ label: "Auto", provider: "Cranium" });
  });

  it("returns an assistant response without requiring a signed-in user", async () => {
    const result = await appRouter.createCaller(createContext()).chat.send({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Say hello to the test suite." }],
    });

    expect(result).toMatchObject({
      content: "A grounded test response.",
      model: "gpt-5-mini",
      grounded: false,
      conversationId: undefined,
    });
    expect(result.usage?.total_tokens).toBe(18);
  });

  it("routes Auto coding requests to the advanced coding model", async () => {
    const result = await appRouter.createCaller(createContext()).chat.send({
      model: "auto",
      messages: [{ role: "user", content: "Debug this TypeScript API error." }],
    });

    expect(result.model).toBe("gpt-5");
  });
});
