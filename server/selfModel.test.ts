import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCraniumSelfModel, selfModelPrompt } from "./selfModel";

const stateDirs: string[] = [];

afterEach(async () => {
  delete process.env.CRANIUM_COMA_STATE_DIR;
  await Promise.all(stateDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe("Convertible Cranium governed self-model", () => {
  it("reports real identity, bounded agency, and honest limits", async () => {
    process.env.CRANIUM_COMA_STATE_DIR = await mkdtemp(join(tmpdir(), "cranium-self-model-"));
    stateDirs.push(process.env.CRANIUM_COMA_STATE_DIR);

    const model = await getCraniumSelfModel();

    expect(model.identity).toBe("Convertible Cranium AI");
    expect(model.presentedBy).toBe("WorthWyl");
    expect(model.agency).toBe("bounded");
    expect(model.awareness.knowsCapabilityLimits).toBe(true);
    expect(model.awareness.tracksUncertainty).toBe(true);
    expect(model.permissions.canChooseResponseStrategy).toBe(true);
    expect(model.permissions.canChangePrimeDirectives).toBe(false);
    expect(model.permissions.canTakeExternalActionsWithoutGate).toBe(false);
    expect(model.honestLimitation).toBe("No claim of subjective consciousness");
  });

  it("includes the live Coma posture in the prompt", async () => {
    process.env.CRANIUM_COMA_STATE_DIR = await mkdtemp(join(tmpdir(), "cranium-self-model-"));
    stateDirs.push(process.env.CRANIUM_COMA_STATE_DIR);

    const model = await getCraniumSelfModel();
    const prompt = selfModelPrompt(model);

    expect(model.coma.mode).toBe("normal");
    expect(prompt).toContain("choose response strategy");
    expect(prompt).toContain("never bypass Coma");
    expect(prompt).toContain("Current Coma state: normal");
    expect(prompt).toContain("as human free will");
  });
});
