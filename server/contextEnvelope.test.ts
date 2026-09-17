import { describe, expect, it } from "vitest";
import { createContextEnvelope, verifyContextEnvelope } from "./contextEnvelope";

const input = {
  correlationId: "correlation-test-001",
  requestText: "What is the canonical Cranium authority boundary?",
  modelId: "test-model",
  grounded: true,
  research: false,
  retrievedAt: "2026-09-16T00:00:00.000Z",
  groundingSources: [
    {
      repo: "cranium-kernel",
      file: "README.md",
      url: "https://github.com/worthwyl2022-cloud/cranium-kernel/blob/main/README.md",
      authority: "canonical" as const,
      excerpt: "Only the kernel authority boundary may commit governed state.",
    },
  ],
  knowledgeSources: [],
};

describe("Cranium context envelope", () => {
  it("creates a deterministic hash for the same evidence", () => {
    expect(createContextEnvelope(input)).toEqual(createContextEnvelope(input));
    expect(verifyContextEnvelope(createContextEnvelope(input))).toBe(true);
  });

  it("detects tampering with a source or request binding", () => {
    const envelope = createContextEnvelope(input);
    expect(verifyContextEnvelope({ ...envelope, requestHash: "0".repeat(64) })).toBe(false);
    expect(verifyContextEnvelope({
      ...envelope,
      sources: [{ ...envelope.sources[0], contentHash: "f".repeat(64) }],
    })).toBe(false);
  });

  it("classifies ungrounded conversational context as proposed", () => {
    const envelope = createContextEnvelope({ ...input, grounded: false });
    expect(envelope.evidenceClass).toBe("proposed");
    expect(envelope.sources[0].authority).toBe("untrusted");
  });
});
