import { createHash } from "node:crypto";

export type SocialState = {
  intent: string;
  emotionalSignals: string[];
  urgency: number;
  uncertainty: number;
  desiredDepth: "concise" | "balanced" | "exhaustive";
  humorSignal: number;
  vulnerabilitySignal: number;
  confidence: number;
};

export type BackgroundCognition = {
  associations: string[];
  attentionCandidates: string[];
  contradictions: string[];
  hypotheses: string[];
  confidence: number;
};

export type Deliberation = {
  responseStrategy: "answer" | "clarify" | "refuse" | "research" | "propose";
  rationale: string[];
  uncertainty: number;
  candidateHash: string;
};

export type MetacognitiveAssessment = {
  evidenceAdequacy: number;
  uncertainty: number;
  contradictionCount: number;
  requiresGrounding: boolean;
  requiresAuthorityGate: boolean;
};

const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function perceiveState(
  input: string,
  preferredDepth: string = "exhaustive"
): SocialState {
  const text = input.trim();
  const normalized = text.toLowerCase();
  const factual =
    /^(who|what|when|where|which|why|how|is|are|was|were|did|does|can|could|latest|current|today)\b/.test(
      normalized
    );
  const urgent = /\b(urgent|asap|immediately|right now|emergency)\b/.test(
    normalized
  );
  const emotionalSignals = [
    /\b(lol|haha|😂|🤣)\b/i.test(text) ? "humor" : "",
    /\b(anxious|anxiety|worried|overwhelmed|frustrated|angry|upset)\b/i.test(
      text
    )
      ? "elevated-emotion"
      : "",
    /!{2,}/.test(text) ? "high-emphasis" : "",
  ].filter(Boolean);
  const desiredDepth: SocialState["desiredDepth"] =
    preferredDepth === "concise" || preferredDepth === "balanced"
      ? preferredDepth
      : "exhaustive";
  return {
    intent: factual
      ? "factual-or-verification"
      : urgent
        ? "urgent-action-or-support"
        : "conversational-or-creative",
    emotionalSignals,
    urgency: urgent ? 0.9 : 0.2,
    uncertainty: text.length < 12 ? 0.55 : 0.2,
    desiredDepth,
    humorSignal: emotionalSignals.includes("humor") ? 0.8 : 0.05,
    vulnerabilitySignal:
      /\b(anxiety|anxious|scared|afraid|hurt|grief|depressed)\b/i.test(text)
        ? 0.8
        : 0.05,
    confidence: text.length >= 20 ? 0.82 : 0.58,
  };
}

export function processSubconscious(
  state: SocialState,
  memoryHints: string[] = []
): BackgroundCognition {
  const associations = [...memoryHints].slice(0, 12);
  const attentionCandidates = [
    ...(state.uncertainty > 0.4 ? ["clarify-or-bound-uncertainty"] : []),
    ...(state.vulnerabilitySignal > 0.6 ? ["protect-user-wellbeing"] : []),
    ...(state.urgency > 0.7 ? ["prioritize-urgent-context"] : []),
  ];
  const contradictions: string[] = [];
  const hypotheses = state.emotionalSignals.map(
    signal => `possible-${signal}-context`
  );
  return {
    associations,
    attentionCandidates,
    contradictions,
    hypotheses,
    confidence: Math.max(0.35, state.confidence - state.uncertainty * 0.5),
  };
}

export function deliberate(
  state: SocialState,
  background: BackgroundCognition,
  evidenceAvailable: boolean
): Deliberation {
  const rationale: string[] = [];
  let responseStrategy: Deliberation["responseStrategy"] = "answer";
  if (state.intent === "factual-or-verification" && !evidenceAvailable) {
    responseStrategy = "research";
    rationale.push("factual request lacks available evidence");
  } else if (state.uncertainty > 0.5) {
    responseStrategy = "clarify";
    rationale.push("material uncertainty detected");
  } else if (background.contradictions.length > 0) {
    responseStrategy = "research";
    rationale.push("background cognition detected contradictions");
  } else {
    rationale.push("available context supports direct response");
  }
  return {
    responseStrategy,
    rationale,
    uncertainty: Math.min(
      1,
      state.uncertainty + background.contradictions.length * 0.1
    ),
    candidateHash: hash(
      JSON.stringify({ state, background, evidenceAvailable })
    ),
  };
}

export function assessDeliberation(
  deliberation: Deliberation,
  evidenceAvailable: boolean
): MetacognitiveAssessment {
  const evidenceAdequacy = evidenceAvailable
    ? 0.9
    : deliberation.responseStrategy === "research"
      ? 0.2
      : 0.6;
  return {
    evidenceAdequacy,
    uncertainty: deliberation.uncertainty,
    contradictionCount: 0,
    requiresGrounding: deliberation.responseStrategy === "research",
    requiresAuthorityGate: true,
  };
}
