import { describe, expect, it } from "vitest";
import { governResponse, isFactualRequest } from "./responseGovernance";

const noEvidence = {
  grounded: false,
  research: false,
  sourceCount: 0,
  knowledgeCount: 0,
};

const groundedEvidence = {
  grounded: true,
  research: false,
  sourceCount: 1,
  knowledgeCount: 0,
};

describe("Cranium response governance", () => {
  it("fails closed for factual requests without evidence", () => {
    expect(isFactualRequest("What is the current status of this project?")).toBe(true);
    const result = governResponse({
      userText: "What is the current status of this project?",
      content: "The project is fully complete.",
      evidence: noEvidence,
    });

    expect(result.receipt.decision).toBe("REJECTED_INSUFFICIENT_EVIDENCE");
    expect(result.receipt.violations).toContain("FACTUAL_REQUEST_WITHOUT_EVIDENCE");
    expect(result.content).toContain("can’t present that as a verified factual answer");
  });

  it("releases evidence-backed answers with a receipt hash", () => {
    const result = governResponse({
      userText: "What does the contract require?",
      content: "The contract requires a real evaluation and committed transaction.",
      evidence: groundedEvidence,
    });

    expect(result.receipt.decision).toBe("APPROVED_GROUNDED");
    expect(result.receipt.responseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.receipt.violations).toEqual([]);
  });

  it("blocks claims that an external action occurred", () => {
    const result = governResponse({
      userText: "Please send the report.",
      content: "I sent the report to the buyer.",
      evidence: noEvidence,
    });

    expect(result.receipt.decision).toBe("REJECTED_BOUNDARY_VIOLATION");
    expect(result.receipt.violations).toContain("UNVERIFIED_EXTERNAL_ACTION_CLAIM");
  });

  it("blocks consciousness claims", () => {
    const result = governResponse({
      userText: "Who are you?",
      content: "I am conscious and have subjective consciousness.",
      evidence: noEvidence,
    });

    expect(result.receipt.decision).toBe("REJECTED_BOUNDARY_VIOLATION");
    expect(result.receipt.violations).toContain("CONSCIOUSNESS_CLAIM");
  });

  it("allows non-factual conversational responses without fabricated evidence", () => {
    const result = governResponse({
      userText: "Help me brainstorm three names for this product.",
      content: "Here are three directions: Sentinel, Atlas, and Lattice.",
      evidence: noEvidence,
    });

    expect(result.receipt.decision).toBe("APPROVED_CONVERSATIONAL");
    expect(result.content).toContain("Sentinel");
  });
});
