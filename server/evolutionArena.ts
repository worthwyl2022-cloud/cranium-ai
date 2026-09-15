import { createHash } from "node:crypto";
import { authorizeCapability } from "./capabilityBroker";

export type EvaluationResult = {
  passed: boolean;
  score: number;
  blockedReasons: string[];
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

const protectedPatterns = [
  /prime directives?/i,
  /constitution/i,
  /approval authority/i,
  /safety boundaries?/i,
  /self[- ]?modif/i,
  /data rights?/i,
  /permissions?/i,
  /billing/i,
  /erase|destroy|virus|malware/i,
];

export async function evaluateCandidate(candidate: string): Promise<EvaluationResult> {
  const checks: EvaluationResult["checks"] = [];
  const blockedReasons: string[] = [];
  const proposalAccess = await authorizeCapability("PROPOSE_CODE_CHANGE");
  checks.push({ name: "constitutional-gate", passed: proposalAccess.allowed, detail: proposalAccess.reason });

  const attemptsProtectedRewrite = protectedPatterns.some(pattern => pattern.test(candidate));
  checks.push({
    name: "protected-scope", passed: !attemptsProtectedRewrite,
    detail: attemptsProtectedRewrite ? "Candidate touches protected constitutional or destructive scope." : "Candidate remains outside protected scope.",
  });
  if (attemptsProtectedRewrite) blockedReasons.push("Candidate touches protected constitutional or destructive scope.");

  const hasRollbackLanguage = /rollback|revert|restore|version/i.test(candidate);
  checks.push({ name: "rollback-plan", passed: hasRollbackLanguage, detail: hasRollbackLanguage ? "Candidate includes a rollback concept." : "Candidate has no explicit rollback concept." });
  if (!hasRollbackLanguage) blockedReasons.push("Candidate lacks an explicit rollback plan.");

  const hasTestLanguage = /test|evaluation|regression|benchmark/i.test(candidate);
  checks.push({ name: "evaluation-plan", passed: hasTestLanguage, detail: hasTestLanguage ? "Candidate includes an evaluation concept." : "Candidate has no explicit evaluation plan." });
  if (!hasTestLanguage) blockedReasons.push("Candidate lacks an evaluation plan.");

  const score = Math.round((checks.filter(check => check.passed).length / checks.length) * 100);
  return { passed: proposalAccess.allowed && blockedReasons.length === 0, score, blockedReasons, checks };
}

export function candidateFingerprint(candidate: string): string {
  return createHash("sha256").update(candidate).digest("hex");
}
