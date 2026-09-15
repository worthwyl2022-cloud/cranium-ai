import { appendFile, mkdir } from "node:fs/promises";
import { createPublicKey, verify } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { Express, Request, Response } from "express";

export const OWNER_ID = "William (Wyl) Mathes — 508022573";
const CONTROL_AUDIT_PATH = resolve(process.cwd(), "runtime/owner-control-audit.jsonl");
const COMMAND_WINDOW_MS = 5 * 60 * 1000;
const replayedCommands = new Set<string>();

export const OWNER_ACTIONS = [
  "PAUSE",
  "SAFE_MODE",
  "RESTORE_SIGNED_VERSION",
  "REVOKE_CREDENTIALS",
  "FREEZE_EXTERNAL_ACTIONS",
  "APPROVE_MAJOR_CHANGE",
  "REJECT_CHANGE",
  "ROTATE_KEYS",
  "EXPORT_AUDIT",
] as const;

type OwnerAction = (typeof OWNER_ACTIONS)[number];

type OwnerCommand = {
  id: string;
  ownerId: string;
  action: OwnerAction;
  reason: string;
  issuedAt: string;
  target?: string;
};

function header(request: Request, name: string): string {
  const value = request.header(name);
  return typeof value === "string" ? value.trim() : "";
}

async function recordAudit(entry: Record<string, unknown>) {
  await mkdir(dirname(CONTROL_AUDIT_PATH), { recursive: true });
  await appendFile(CONTROL_AUDIT_PATH, `${JSON.stringify({ ...entry, recordedAt: new Date().toISOString() })}\n`, "utf8");
}

function isOwnerCommand(value: unknown): value is OwnerCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Partial<OwnerCommand>;
  return typeof command.id === "string"
    && command.id.length >= 16
    && command.ownerId === OWNER_ID
    && typeof command.reason === "string"
    && command.reason.length >= 3
    && typeof command.issuedAt === "string"
    && OWNER_ACTIONS.includes(command.action as OwnerAction);
}

export function registerOwnerControl(app: Express) {
  app.post("/api/owner-control", async (request: Request, response: Response) => {
    const publicKeyPem = process.env.CRANIUM_OWNER_CONTROL_PUBLIC_KEY?.trim();
    const signature = header(request, "X-Cranium-Signature");
    const body = request.body as unknown;

    if (!publicKeyPem) {
      response.status(503).json({ ok: false, error: "Owner control is not configured." });
      return;
    }
    if (!isOwnerCommand(body)) {
      response.status(400).json({ ok: false, error: "Invalid owner command." });
      return;
    }
    if (replayedCommands.has(body.id)) {
      response.status(409).json({ ok: false, error: "Command replay rejected." });
      return;
    }

    const issuedAt = Date.parse(body.issuedAt);
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > COMMAND_WINDOW_MS) {
      response.status(400).json({ ok: false, error: "Command is outside the five-minute validity window." });
      return;
    }

    const canonical = JSON.stringify(body);
    let validSignature = false;
    try {
      validSignature = verify(null, Buffer.from(canonical), createPublicKey(publicKeyPem), Buffer.from(signature, "base64url"));
    } catch {
      validSignature = false;
    }
    if (!validSignature) {
      await recordAudit({ ok: false, type: "owner-command-rejected", commandId: body.id, reason: "invalid-signature" });
      response.status(401).json({ ok: false, error: "Invalid owner signature." });
      return;
    }

    replayedCommands.add(body.id);
    await recordAudit({ ok: true, type: "owner-command-accepted", command: body });
    response.json({ ok: true, ownerId: OWNER_ID, action: body.action, status: "accepted-for-controlled-execution" });
  });
}
