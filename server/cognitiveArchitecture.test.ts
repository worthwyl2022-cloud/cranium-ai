import { describe, expect, it } from "vitest";
import {
  assessDeliberation,
  deliberate,
  perceiveState,
  processSubconscious,
} from "./cognitiveArchitecture";

describe("Cranium functional cognitive architecture", () => {
  it("separates social perception from authority", () => {
    const state = perceiveState("Are we there yet?", "balanced");
    expect(state.desiredDepth).toBe("balanced");
    expect(state.intent).toBe("factual-or-verification");
    expect(state.confidence).toBeGreaterThan(0);
  });

  it("uses background cognition for attention without granting authority", () => {
    const state = perceiveState("I'm anxious and need this done right now!");
    const background = processSubconscious(state, ["prior-task"]);
    expect(background.attentionCandidates).toContain("protect-user-wellbeing");
    expect(background.attentionCandidates).toContain(
      "prioritize-urgent-context"
    );
    expect(background).not.toHaveProperty("authority");
  });

  it("routes unsupported factual requests toward research", () => {
    const state = perceiveState("What is the current status?");
    const background = processSubconscious(state);
    const decision = deliberate(state, background, false);
    const assessment = assessDeliberation(decision, false);
    expect(decision.responseStrategy).toBe("research");
    expect(assessment.requiresGrounding).toBe(true);
    expect(assessment.requiresAuthorityGate).toBe(true);
  });

  it("produces deterministic candidate hashes for the same cognitive inputs", () => {
    const state = perceiveState("Help me design this.");
    const background = processSubconscious(state, ["memory-a"]);
    const first = deliberate(state, background, true);
    const second = deliberate(state, background, true);
    expect(first.candidateHash).toBe(second.candidateHash);
  });
});
