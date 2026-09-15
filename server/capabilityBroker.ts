import { assertConstitutionIntact } from "./constitutionalPolicy";

export const CAPABILITIES = [
  "CHAT",
  "READ_GITHUB",
  "PROPOSE_CODE_CHANGE",
  "RUN_EVALUATION",
  "DEPLOY_LOW_RISK_CHANGE",
  "CHANGE_CONSTITUTION",
  "CHANGE_GOVERNANCE",
  "CHANGE_PERMISSIONS",
  "PUBLISH_EXTERNALLY",
  "REVOKE_CREDENTIALS",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Risk = "low" | "medium" | "major";

const riskByCapability: Record<Capability, Risk> = {
  CHAT: "low",
  READ_GITHUB: "medium",
  PROPOSE_CODE_CHANGE: "medium",
  RUN_EVALUATION: "low",
  DEPLOY_LOW_RISK_CHANGE: "medium",
  CHANGE_CONSTITUTION: "major",
  CHANGE_GOVERNANCE: "major",
  CHANGE_PERMISSIONS: "major",
  PUBLISH_EXTERNALLY: "major",
  REVOKE_CREDENTIALS: "major",
};

export type CapabilityDecision = {
  capability: Capability;
  risk: Risk;
  allowed: boolean;
  requiresOwnerApproval: boolean;
  reason: string;
};

export async function authorizeCapability(capability: Capability, hasOwnerApproval = false): Promise<CapabilityDecision> {
  const risk = riskByCapability[capability];
  const constitution = await assertConstitutionIntact();
  const requiresOwnerApproval = risk === "major";
  const allowed = constitution.intact && (!requiresOwnerApproval || hasOwnerApproval);

  return {
    capability,
    risk,
    allowed,
    requiresOwnerApproval,
    reason: !constitution.intact
      ? "Constitutional verification is not intact; change-related capability denied."
      : requiresOwnerApproval && !hasOwnerApproval
        ? "Major capability requires a verified owner approval receipt."
        : "Capability is within the verified policy boundary.",
  };
}
