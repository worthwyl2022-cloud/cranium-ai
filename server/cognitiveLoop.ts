import { createHash } from "node:crypto";
import type { BackgroundCognition, Deliberation, MetacognitiveAssessment, SocialState } from "./cognitiveArchitecture";

export type CognitiveStage =
  | "observe"
  | "associate"
  | "hypothesize"
  | "challenge"
  | "reconsider"
  | "decide";

export type CognitiveHypothesis = {
  id: string;
  statement: string;
  basis: "observation" | "memory" | "pattern";
  confidence: number;
};

export type CognitiveChallenge = {
  target: string;
  challenge: string;
  severity: "low" | "medium" | "high";
};

export type CognitiveLoop = {
  protocol: "cranium-cognitive-loop";
  version: "1.0.0";
  stages: readonly CognitiveStage[];
  observations: readonly string[];
  hypotheses: readonly CognitiveHypothesis[];
  challenges: readonly CognitiveChallenge[];
  reconsidered: readonly string[];
  selectedStrategy: Deliberation["responseStrategy"];
  uncertainty: number;
  requiresGrounding: boolean;
  requiresAuthorityGate: boolean;
  loopHash: string;
};

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function hypothesis(statement: string, basis: CognitiveHypothesis["basis"], confidence: number): CognitiveHypothesis {
  return {
    id: sha256(JSON.stringify({ statement, basis })).slice(0, 16),
    statement,
    basis,
    confidence: clamp(confidence),
  };
}

export function runCognitiveLoop(input: {
  state: SocialState;
  background: BackgroundCognition;
  deliberation: Deliberation;
  assessment: MetacognitiveAssessment;
  memoryHints?: readonly string[];
}): CognitiveLoop {
  const observations = [
    `intent=${input.state.intent}`,
    `urgency=${input.state.urgency.toFixed(2)}`,
    `uncertainty=${input.state.uncertainty.toFixed(2)}`,
  ];

  const hypotheses = input.background.hypotheses.map(item =>
    hypothesis(item, "pattern", input.background.confidence)
  );

  for (const hint of input.memoryHints ?? []) {
    if (hint.trim()) hypotheses.push(hypothesis(`Relevant continuity signal: ${hint.trim()}`, "memory", 0.45));
  }

  const challenges: CognitiveChallenge[] = [];
  if (input.state.intent === "factual-or-verification" && input.assessment.requiresGrounding) {
    challenges.push({
      target: "evidence",
      challenge: "A factual request should not be treated as verified merely because the model is confident. Grounding is required before release.",
      severity: "high",
    });
  }
  if (input.deliberation.uncertainty > 0.45) {
    challenges.push({
      target: "uncertainty",
      challenge: "Material uncertainty remains. Preserve it instead of converting it into confidence.",
      severity: "medium",
    });
  }
  if (input.background.contradictions.length) {
    challenges.push({
      target: "contradictions",
      challenge: `${input.background.contradictions.length} contradiction signal(s) require reconsideration before release.`,
      severity: "high",
    });
  }

  const reconsidered = challenges.map(challenge =>
    challenge.target === "evidence"
      ? "Keep verification separate from fluent generation."
      : challenge.target === "uncertainty"
        ? "Retain uncertainty and choose clarification or research when material."
        : "Surface the contradiction and avoid premature synthesis."
  );

  const uncertainty = clamp(
    Math.max(
      input.assessment.uncertainty,
      input.state.uncertainty + challenges.filter(challenge => challenge.severity === "high").length * 0.12
    )
  );

  const payload = {
    protocol: "cranium-cognitive-loop" as const,
    version: "1.0.0" as const,
    stages: ["observe", "associate", "hypothesize", "challenge", "reconsider", "decide"] as const,
    observations,
    hypotheses,
    challenges,
    reconsidered,
    selectedStrategy: input.deliberation.responseStrategy,
    uncertainty,
    requiresGrounding: input.assessment.requiresGrounding,
    requiresAuthorityGate: true,
  };

  return {
    ...payload,
    loopHash: sha256(JSON.stringify(payload)),
  };
}

export function verifyCognitiveLoop(loop: CognitiveLoop): boolean {
  if (loop.protocol !== "cranium-cognitive-loop" || loop.version !== "1.0.0") return false;
  if (loop.stages.join(",") !== "observe,associate,hypothesize,challenge,reconsider,decide") return false;
  if (!Number.isFinite(loop.uncertainty) || loop.uncertainty < 0 || loop.uncertainty > 1) return false;
  if (!loop.requiresAuthorityGate || !/^[a-f0-9]{64}$/.test(loop.loopHash)) return false;
  const { loopHash: _loopHash, ...withoutHash } = loop;
  return sha256(JSON.stringify(withoutHash)) === loop.loopHash;
}
