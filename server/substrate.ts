export type SubstrateReceipt = {
  authority: "cranium-kernel";
  transactionId: string;
  requestHash: string;
  journalSequence: number;
  stateHash: string;
  decision: "Granted" | "Denied";
};

export type SubstratePass = {
  governed: true;
  authority: "cranium-kernel";
  synapse: {
    assessmentId: string;
    correlationId: string;
    modelId: string;
    riskClass: string;
    riskScore: number;
    confidence: number;
    intervention: string;
    disposition: string;
    traceCommitment: string;
  };
  core: SubstrateReceipt;
};

const substrateUrl = () => {
  const value = process.env.CRANIUM_SUBSTRATE_URL?.trim();
  if (!value) throw new Error("CRANIUM_SUBSTRATE_URL is not configured; Cranium AI cannot bypass the substrate");
  return value.replace(/\/$/, "");
};

export async function submitThroughSubstrate(input: {
  correlationId: string;
  modelId: string;
  content: string;
}): Promise<SubstratePass> {
  const response = await fetch(`${substrateUrl()}/v1/substrate/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as Partial<SubstratePass> & { error?: string };
  if (!response.ok || payload.governed !== true || payload.authority !== "cranium-kernel" || payload.core?.decision !== "Granted") {
    throw new Error(`Cranium substrate rejected response: ${payload.error ?? `HTTP ${response.status}`}`);
  }
  return payload as SubstratePass;
}
