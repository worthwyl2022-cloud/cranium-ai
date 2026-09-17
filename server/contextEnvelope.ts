import { createHash } from "node:crypto";
import type { GroundingSource } from "./grounding";
import type { WorldKnowledgeSource } from "./worldKnowledge";

export type ContextAuthority = "canonical" | "supporting" | "historical" | "untrusted";
export type ContextEvidenceClass = "observed" | "inferred" | "proposed";
export type ContextSource = {
  kind: "model" | "repository" | "web" | "user" | "memory" | "tool";
  identifier: string;
  authority: ContextAuthority;
  retrievedAt: string;
  contentHash: string;
};

export type CraniumContextEnvelope = {
  protocol: "cranium-context-envelope";
  version: "1.0.0";
  correlationId: string;
  policyVersion: string;
  evidenceClass: ContextEvidenceClass;
  uncertainty: number;
  requestHash: string;
  sources: readonly ContextSource[];
  contentHash: string;
};

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
}

const sourceHash = (value: string) => sha256(value.trim());

export function createContextEnvelope(input: {
  correlationId: string;
  requestText: string;
  modelId: string;
  policyVersion?: string;
  grounded: boolean;
  research: boolean;
  retrievedAt: string;
  groundingSources: readonly GroundingSource[];
  knowledgeSources: readonly WorldKnowledgeSource[];
}): CraniumContextEnvelope {
  const sources: ContextSource[] = [
    {
      kind: "model",
      identifier: input.modelId,
      authority: "untrusted",
      retrievedAt: input.retrievedAt,
      contentHash: sourceHash(input.modelId),
    },
    ...input.groundingSources.map(source => ({
      kind: "repository" as const,
      identifier: `${source.repo}/${source.file}`,
      authority: source.authority === "non-authority" ? "untrusted" as const : source.authority,
      retrievedAt: input.retrievedAt,
      contentHash: sourceHash(source.excerpt),
    })),
    ...input.knowledgeSources.map(source => ({
      kind: "web" as const,
      identifier: source.url,
      authority: "untrusted" as const,
      retrievedAt: input.retrievedAt,
      contentHash: sourceHash(`${source.title}\n${source.snippet}`),
    })),
  ];
  const evidenceClass: ContextEvidenceClass = input.grounded || input.research ? "observed" : "proposed";
  const envelopeWithoutHash = {
    protocol: "cranium-context-envelope" as const,
    version: "1.0.0" as const,
    correlationId: input.correlationId,
    policyVersion: input.policyVersion ?? "cranium-ai.response-governance.v1",
    evidenceClass,
    uncertainty: sources.length > 1 ? 0.35 : 0.8,
    requestHash: sha256(input.requestText.trim()),
    sources,
  };
  return {
    ...envelopeWithoutHash,
    contentHash: sha256(canonicalize(envelopeWithoutHash)),
  };
}

export function verifyContextEnvelope(envelope: CraniumContextEnvelope): boolean {
  if (envelope.protocol !== "cranium-context-envelope" || envelope.version !== "1.0.0") return false;
  if (!envelope.correlationId || !envelope.policyVersion || !/^[a-f0-9]{64}$/.test(envelope.contentHash)) return false;
  if (!Number.isFinite(envelope.uncertainty) || envelope.uncertainty < 0 || envelope.uncertainty > 1) return false;
  const { contentHash: _contentHash, ...withoutHash } = envelope;
  return sha256(canonicalize(withoutHash)) === envelope.contentHash;
}
