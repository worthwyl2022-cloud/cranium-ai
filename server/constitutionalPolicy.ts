import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const CONSTITUTION_ID = "cranium-constitution-v1";
export const PROTECTED_APPROVER = "William (Wyl) Mathes — 508022573";
export const PROTECTION_TERM = "five years from acquisition closing";

const constitutionPath = resolve(process.cwd(), "constitution/PRIME_DIRECTIVES.md");

export type ConstitutionalStatus = {
  constitutionId: string;
  protectedApprover: string;
  protectionTerm: string;
  intact: boolean;
  configured: boolean;
  mode: "normal" | "read-only-safe";
  reason: string;
};

export async function verifyConstitution(): Promise<ConstitutionalStatus> {
  const constitution = await readFile(constitutionPath);
  const actualHash = createHash("sha256").update(constitution).digest("hex");
  const expectedHash = process.env.CRANIUM_CONSTITUTION_SHA256?.trim().toLowerCase();
  const configured = Boolean(expectedHash);
  const intact = configured && expectedHash === actualHash;

  return {
    constitutionId: CONSTITUTION_ID,
    protectedApprover: PROTECTED_APPROVER,
    protectionTerm: PROTECTION_TERM,
    intact,
    configured,
    mode: intact ? "normal" : "read-only-safe",
    reason: intact
      ? "Constitution hash matches the protected deployment value."
      : configured
        ? "Constitution hash mismatch; change-related operations are blocked."
        : "Protected deployment hash is not configured; change-related operations are blocked.",
  };
}

export async function assertConstitutionIntact(): Promise<ConstitutionalStatus> {
  const status = await verifyConstitution();
  if (!status.intact) {
    console.error(`[Cranium constitutional gate] ${status.reason}`);
  }
  return status;
}
