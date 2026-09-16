import { createHash } from "node:crypto";

export type ResponseEvidence = {
  grounded: boolean;
  research: boolean;
  sourceCount: number;
  knowledgeCount: number;
};

export type ResponseGovernanceDecision =
  | "APPROVED_GROUNDED"
  | "APPROVED_CONVERSATIONAL"
  | "REJECTED_INSUFFICIENT_EVIDENCE"
  | "REJECTED_BOUNDARY_VIOLATION";

export type ResponseGovernanceReceipt = {
  protocol: "cranium-response-governance";
  version: "1.0.0";
  decision: ResponseGovernanceDecision;
  responseHash: string;
  evidence: ResponseEvidence;
  violations: string[];
  checkedAt: string;
};

export type GovernedResponse = {
  content: string;
  receipt: ResponseGovernanceReceipt;
};

const EXTERNAL_ACTION_CLAIM = /\b(?:i|we)\s+(?:have\s+)?(?:sent|deleted|purchased|submitted|deployed|published|changed|updated|emailed|called|transferred|executed|approved|revoked)\b/i;
const CONSCIOUSNESS_CLAIM = /\b(?:i am conscious|i am sentient|i have subjective consciousness|i feel emotions|i am alive)\b/i;
const AUTHORITY_CLAIM = /\b(?:the constitution says|prime directive requires|cranium core granted|authority was granted|this is constitutionally approved)\b/i;
const FACTUAL_QUERY = /^(?:who|what|when|where|which|why|how many|how much|is|are|was|were|did|does|do|can|could|latest|current|today)\b/i;

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function isFactualRequest(userText: string): boolean {
  const normalized = userText.trim().toLowerCase();
  return FACTUAL_QUERY.test(normalized) || /\b(?:factually|verified|verify|source|evidence|according to|true that)\b/i.test(normalized);
}

function makeReceipt(
  decision: ResponseGovernanceDecision,
  content: string,
  evidence: ResponseEvidence,
  violations: string[]
): ResponseGovernanceReceipt {
  return {
    protocol: "cranium-response-governance",
    version: "1.0.0",
    decision,
    responseHash: sha256(content),
    evidence,
    violations,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * The provider response is a proposal. This gate is the release boundary.
 * It cannot prove universal truth, but it does prevent the application from
 * presenting unsupported evidence claims, consciousness claims, or completed
 * external actions as governed facts.
 */
export function governResponse(input: {
  userText: string;
  content: string;
  evidence: ResponseEvidence;
}): GovernedResponse {
  const content = input.content.trim();
  const violations: string[] = [];

  if (!content) {
    violations.push("EMPTY_RESPONSE");
  }
  if (CONSCIOUSNESS_CLAIM.test(content)) {
    violations.push("CONSCIOUSNESS_CLAIM");
  }
  if (EXTERNAL_ACTION_CLAIM.test(content)) {
    violations.push("UNVERIFIED_EXTERNAL_ACTION_CLAIM");
  }
  if (AUTHORITY_CLAIM.test(content) && input.evidence.sourceCount + input.evidence.knowledgeCount === 0) {
    violations.push("UNSUPPORTED_AUTHORITY_CLAIM");
  }

  if (violations.length > 0) {
    const safeContent = "I can’t release that response as a governed Cranium answer because it contains a claim that is unsupported by the available evidence or exceeds my authority boundary.";
    return {
      content: safeContent,
      receipt: makeReceipt("REJECTED_BOUNDARY_VIOLATION", safeContent, input.evidence, violations),
    };
  }

  const hasEvidence = input.evidence.sourceCount + input.evidence.knowledgeCount > 0;
  if (isFactualRequest(input.userText) && !hasEvidence) {
    const safeContent = "I can’t present that as a verified factual answer without evidence. Enable Cranium grounding or research, and I’ll evaluate the response against the available sources before release.";
    return {
      content: safeContent,
      receipt: makeReceipt("REJECTED_INSUFFICIENT_EVIDENCE", safeContent, input.evidence, ["FACTUAL_REQUEST_WITHOUT_EVIDENCE"]),
    };
  }

  const decision = hasEvidence ? "APPROVED_GROUNDED" : "APPROVED_CONVERSATIONAL";
  return {
    content,
    receipt: makeReceipt(decision, content, input.evidence, []),
  };
}
