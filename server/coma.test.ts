import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertExternalActionsAllowed, readComaState, transitionComa } from "./coma";

const stateDirs: string[] = [];
afterEach(async () => {
  delete process.env.CRANIUM_COMA_STATE_DIR;
  await Promise.all(stateDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function useRealStateDirectory() {
  const path = await mkdtemp(join(tmpdir(), "cranium-coma-"));
  stateDirs.push(path);
  process.env.CRANIUM_COMA_STATE_DIR = path;
  return path;
}

describe("Cranium Coma", () => {
  it("persists a real active state and append-only incident event", async () => {
    const path = await useRealStateDirectory();
    const active = await transitionComa({
      action: "enter",
      cause: "Live containment boundary test",
      authority: "test-harness",
      incidentId: "live-test-incident",
    });
    expect(active.mode).toBe("active");
    expect((await readComaState()).incidentId).toBe("live-test-incident");
    const events = await readFile(join(path, "events.jsonl"), "utf8");
    expect(events).toContain('"to":"active"');
    expect(events).toContain('"authority":"test-harness"');
  });

  it("denies external actions while Coma is active", async () => {
    await useRealStateDirectory();
    await transitionComa({ action: "enter", cause: "Freeze boundary test", authority: "test-harness" });
    await expect(assertExternalActionsAllowed()).rejects.toThrow("External actions are frozen");
  });

  it("requires an explicit authorized resume transition", async () => {
    await useRealStateDirectory();
    await transitionComa({ action: "enter", cause: "Resume boundary test", authority: "test-harness" });
    const resumed = await transitionComa({ action: "resume", cause: "Human review completed", authority: "human-review" });
    expect(resumed.mode).toBe("normal");
    await expect(assertExternalActionsAllowed()).resolves.toBeUndefined();
  });
});
