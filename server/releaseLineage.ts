import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CONSTITUTION_ID, PROTECTED_APPROVER, PROTECTION_TERM } from "./constitutionalPolicy";

export type ReleaseReceipt = {
  receiptVersion: "1";
  releaseId: string;
  sourceCommit: string;
  constitutionId: string;
  constitutionHash: string;
  approver: string;
  protectionTerm: string;
  modelProvider: string;
  evaluationSummary: string;
  rollbackTarget: string;
  createdAt: string;
};

export async function createReleaseReceipt(input: {
  sourceCommit: string;
  modelProvider: string;
  evaluationSummary: string;
  rollbackTarget: string;
}): Promise<ReleaseReceipt> {
  const constitution = await readFile(resolve(process.cwd(), "constitution/PRIME_DIRECTIVES.md"));
  const constitutionHash = createHash("sha256").update(constitution).digest("hex");
  const createdAt = new Date().toISOString();
  const releaseId = createHash("sha256").update(`${input.sourceCommit}:${constitutionHash}:${createdAt}`).digest("hex").slice(0, 16);
  return {
    receiptVersion: "1",
    releaseId,
    sourceCommit: input.sourceCommit,
    constitutionId: CONSTITUTION_ID,
    constitutionHash,
    approver: PROTECTED_APPROVER,
    protectionTerm: PROTECTION_TERM,
    modelProvider: input.modelProvider,
    evaluationSummary: input.evaluationSummary,
    rollbackTarget: input.rollbackTarget,
    createdAt,
  };
}
