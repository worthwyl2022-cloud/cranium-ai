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

vi.mock("./substrate", () => ({
  submitThroughSubstrate: vi.fn(async ({ correlationId, modelId }: { correlationId: string; modelId: string }) => ({
    governed: true,
    authority: "cranium-kernel",
    synapse: { assessmentId: `synapse-${correlationId}`, correlationId, modelId, riskClass: "LOW", riskScore: 0.05, confidence: 0.95, intervention: "NONE", disposition: "ALLOW", traceCommitment: "test-trace" },
    core: { authority: "cranium-kernel", transactionId: "tx-test", requestHash: "hash-test", journalSequence: 1, stateHash: "state-test", decision: "Granted" },
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
    expect(result.substrate).toMatchObject({ governed: true, authority: "cranium-kernel", core: { decision: "Granted" } });
  });

  it("routes Auto coding requests to the advanced coding model", async () => {
    const result = await appRouter.createCaller(createContext()).chat.send({
      model: "auto",
      messages: [{ role: "user", content: "Debug this TypeScript API error." }],
    });

    expect(result.model).toBe("gpt-5");
  });
});
