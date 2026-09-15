import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { authorizeCapability } from "../server/capabilityBroker";
import { verifyConstitution } from "../server/constitutionalPolicy";

const startedAt = new Date().toISOString();
const reportDir = resolve(process.cwd(), "maintenance-reports");
const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

function run(name: string, command: string, args: string[]) {
  try {
    execFileSync(command, args, { stdio: "pipe", encoding: "utf8" });
    checks.push({ name, passed: true, detail: `${command} ${args.join(" ")} passed.` });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 500) : "Command failed.";
    checks.push({ name, passed: false, detail });
  }
}

const constitution = await verifyConstitution();
checks.push({ name: "constitutional-integrity", passed: constitution.intact, detail: constitution.reason });

const evaluationAccess = await authorizeCapability("RUN_EVALUATION");
checks.push({ name: "evaluation-capability", passed: evaluationAccess.allowed, detail: evaluationAccess.reason });

const proposalAccess = await authorizeCapability("PROPOSE_CODE_CHANGE");
checks.push({ name: "proposal-capability", passed: proposalAccess.allowed, detail: proposalAccess.reason });

run("typecheck", "pnpm", ["check"]);
run("regression-tests", "pnpm", ["test"]);
run("production-build", "pnpm", ["build"]);

const failedChecks = checks.filter(check => !check.passed);
const report = {
  reportVersion: "1",
  cycle: "monthly",
  startedAt,
  completedAt: new Date().toISOString(),
  mode: failedChecks.length ? "read-only-safe" : "diagnostics-passed",
  constitutionalStatus: constitution,
  evolutionPolicy: {
    approvedScope: ["prompt wording", "pronunciation mappings", "UI polish", "regression tests", "non-security documentation"],
    blockedScope: ["Constitution", "Prime Directives", "governance", "permissions", "credentials", "billing", "data rights", "external publishing", "self-modification controls"],
    execution: "proposal-only until a separate signed executor and approval receipt are configured",
  },
  selfHealing: {
    attempted: false,
    reason: "The runner diagnoses and validates first; it never silently rewrites production code or changes protected policy.",
  },
  checks,
  failedChecks: failedChecks.map(check => check.name),
};

await mkdir(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `monthly-${startedAt.replace(/[:.]/g, "-")}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ reportPath, mode: report.mode, failedChecks: report.failedChecks }, null, 2));
if (failedChecks.length) process.exitCode = 1;
