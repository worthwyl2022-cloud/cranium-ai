import { describe, expect, it } from "vitest";
import {
  learnFromCognitiveEpisode,
  verifyCognitiveLearning,
} from "./cognitiveLearning";

describe("governed cognitive learning", () => {
  it("records evidence and uncertainty lessons with integrity", () => {
    const state = learnFromCognitiveEpisode({
      episodeId: "episode-1",
      uncertainty: 0.7,
      requiresGrounding: true,
      challengeCount: 2,
      contradictions: 1,
    });

    expect(state.signals.length).toBe(4);
    expect(state.adaptations).toEqual([]);
    expect(verifyCognitiveLearning(state)).toBe(true);
  });

  it("turns explicit correction into a bounded adaptation", () => {
    const state = learnFromCognitiveEpisode({
      episodeId: "episode-2",
      uncertainty: 0.1,
      requiresGrounding: false,
      challengeCount: 0,
      contradictions: 0,
      userFeedback: [
        {
          statement: "Prefer concise technical explanations.",
          outcome: "corrected",
          category: "preference",
        },
      ],
    });

    expect(state.signals.some(s => s.outcome === "corrected")).toBe(true);
    expect(state.adaptations).toHaveLength(1);
    expect(verifyCognitiveLearning(state)).toBe(true);
  });

  it("rejects tampered learning state", () => {
    const state = learnFromCognitiveEpisode({
      episodeId: "episode-3",
      uncertainty: 0.2,
      requiresGrounding: false,
      challengeCount: 1,
      contradictions: 0,
    });

    const tampered = {
      ...state,
      signals: [...state.signals, state.signals[0]],
    };

    expect(verifyCognitiveLearning(tampered)).toBe(false);
  });
});
