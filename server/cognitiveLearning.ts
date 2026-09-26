import { createHash } from "node:crypto";

export type LearningOutcome = "confirmed" | "corrected" | "rejected" | "unresolved";

export type LearningSignal = {
  id: string;
  category: "belief" | "preference" | "strategy" | "uncertainty";
  statement: string;
  outcome: LearningOutcome;
  confidence: number;
  source: "user-feedback" | "observed-consequence" | "self-review";
};

export type CognitiveLearningState = {
  protocol: "cranium-cognitive-learning";
  version: "1.0.0";
  episodeId: string;
  signals: readonly LearningSignal[];
  adaptations: readonly string[];
  integrityHash: string;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function signal(
  category: LearningSignal["category"],
  statement: string,
  outcome: LearningOutcome,
  confidence: number,
  source: LearningSignal["source"],
): LearningSignal {
  return {
    id: sha256(JSON.stringify({ category, statement, outcome })).slice(0, 16),
    category,
    statement,
    outcome,
    confidence: clamp(confidence),
    source,
  };
}

export function learnFromCognitiveEpisode(input: {
  episodeId: string;
  uncertainty: number;
  requiresGrounding: boolean;
  challengeCount: number;
  contradictions: number;
  userFeedback?: readonly {
    statement: string;
    outcome: LearningOutcome;
    category?: LearningSignal["category"];
  }[];
}): CognitiveLearningState {
  const signals: LearningSignal[] = [];

  if (input.requiresGrounding) {
    signals.push(
      signal(
        "strategy",
        "Verification-sensitive requests require explicit evidence before release.",
        "confirmed",
        0.95,
        "self-review",
      ),
    );
  }

  if (input.uncertainty >= 0.45) {
    signals.push(
      signal(
        "uncertainty",
        "Material uncertainty should remain visible rather than being converted into confidence.",
        "confirmed",
        0.95,
        "self-review",
      ),
    );
  }

  if (input.contradictions > 0) {
    signals.push(
      signal(
        "belief",
        "Contradictory evidence should trigger reconsideration before synthesis.",
        "confirmed",
        0.92,
        "observed-consequence",
      ),
    );
  }

  if (input.challengeCount > 0) {
    signals.push(
      signal(
        "strategy",
        "Cognitive challenges should remain attached to the reasoning episode.",
        "confirmed",
        0.9,
        "self-review",
      ),
    );
  }

  for (const feedback of input.userFeedback ?? []) {
    if (!feedback.statement.trim()) continue;
    signals.push(
      signal(
        feedback.category ?? "belief",
        feedback.statement.trim(),
        feedback.outcome,
        feedback.outcome === "confirmed" ? 0.85 : 0.7,
        "user-feedback",
      ),
    );
  }

  const adaptations = Array.from(
    new Set(
      signals
        .filter(s => s.outcome === "corrected" || s.outcome === "rejected")
        .map(s => `Revisit ${s.category}: ${s.statement}`),
    ),
  );

  const payload = {
    protocol: "cranium-cognitive-learning" as const,
    version: "1.0.0" as const,
    episodeId: input.episodeId,
    signals,
    adaptations,
  };

  return {
    ...payload,
    integrityHash: sha256(JSON.stringify(payload)),
  };
}

export function verifyCognitiveLearning(state: CognitiveLearningState): boolean {
  if (
    state.protocol !== "cranium-cognitive-learning" ||
    state.version !== "1.0.0" ||
    !state.episodeId.trim()
  ) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/.test(state.integrityHash)) return false;
  const { integrityHash: _, ...payload } = state;
  return sha256(JSON.stringify(payload)) === state.integrityHash;
}
