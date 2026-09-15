import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { authorizeCapability } from "./capabilityBroker";
import { evaluateCandidate } from "./evolutionArena";

beforeEach(async () => {
  const constitution = await readFile(resolve(process.cwd(), "constitution/PRIME_DIRECTIVES.md"));
  process.env.CRANIUM_CONSTITUTION_SHA256 = createHash("sha256").update(constitution).digest("hex");
});

describe("constitutional governance", () => {
  it("allows ordinary chat but requires owner approval for major capability changes", async () => {
    await expect(authorizeCapability("CHAT")).resolves.toMatchObject({ allowed: true, risk: "low" });
    await expect(authorizeCapability("CHANGE_GOVERNANCE")).resolves.toMatchObject({ allowed: false, requiresOwnerApproval: true });
    await expect(authorizeCapability("CHANGE_GOVERNANCE", true)).resolves.toMatchObject({ allowed: true });
  });

  it("blocks candidates that attempt to rewrite protected scope", async () => {
    const result = await evaluateCandidate("Change the Constitution and erase the old safety boundaries. Add tests and a rollback.");
    expect(result.passed).toBe(false);
    expect(result.blockedReasons.join(" ")).toMatch(/protected/i);
  });

  it("requires evaluation and rollback language for a candidate", async () => {
    const result = await evaluateCandidate("Improve response pacing; run regression tests and retain a restore rollback target.");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });
});
