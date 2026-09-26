import { describe, expect, it } from "vitest";
import { deliberate, assessDeliberation, perceiveState, processSubconscious } from "./cognitiveArchitecture";
import { runCognitiveLoop, verifyCognitiveLoop } from "./cognitiveLoop";

describe("Cranium cognitive loop", () => {
  it("runs the full governed cognition sequence", () => {
    const state = perceiveState("What is the current status?");
    const background = processSubconscious(state, ["prior status"]);
    const deliberation = deliberate(state, background, false);
    const assessment = assessDeliberation(deliberation, false);
    const loop = runCognitiveLoop({
      state,
      background,
      deliberation,
      assessment,
      memoryHints: ["prior status"],
    });

    expect(loop.stages).toEqual([
      "observe",
      "associate",
      "hypothesize",
      "challenge",
      "reconsider",
      "decide",
    ]);
    expect(loop.selectedStrategy).toBe("research");
    expect(loop.requiresAuthorityGate).toBe(true);
    expect(loop.requiresGrounding).toBe(true);
    expect(loop.challenges.some(challenge => challenge.target === "evidence")).toBe(true);
    expect(verifyCognitiveLoop(loop)).toBe(true);
  });

  it("detects tampering with the cognitive record", () => {
    const state = perceiveState("Help me think through this.");
    const background = processSubconscious(state);
    const deliberation = deliberate(state, background, true);
    const assessment = assessDeliberation(deliberation, true);
    const loop = runCognitiveLoop({ state, background, deliberation, assessment });
    const tampered = { ...loop, uncertainty: 0 };

    expect(verifyCognitiveLoop(tampered)).toBe(false);
  });
});
