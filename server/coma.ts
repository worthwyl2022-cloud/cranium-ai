import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ComaMode = "normal" | "containment-pending" | "active" | "restoring" | "quarantined";
export type ComaAction = "enter" | "resume" | "restore" | "quarantine";

export type ComaState = {
  mode: ComaMode;
  incidentId: string | null;
  cause: string | null;
  enteredAt: string | null;
  updatedAt: string;
  transitionCount: number;
};

type ComaEvent = {
  action: ComaAction;
  from: ComaMode;
  to: ComaMode;
  incidentId: string | null;
  cause: string;
  authority: string;
  at: string;
};

const stateDir = () => process.env.CRANIUM_COMA_STATE_DIR || join(process.cwd(), "data", "coma");
const statePath = () => join(stateDir(), "state.json");
const eventPath = () => join(stateDir(), "events.jsonl");

const now = () => new Date().toISOString();
const initialState = (): ComaState => ({
  mode: "normal",
  incidentId: null,
  cause: null,
  enteredAt: null,
  updatedAt: now(),
  transitionCount: 0,
});

async function persist(state: ComaState) {
  await mkdir(stateDir(), { recursive: true });
  const tempPath = `${statePath()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, statePath());
}

export async function readComaState(): Promise<ComaState> {
  try {
    return JSON.parse(await readFile(statePath(), "utf8")) as ComaState;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
    const state = initialState();
    await persist(state);
    return state;
  }
}

const nextMode = (current: ComaMode, action: ComaAction): ComaMode => {
  if (action === "enter" && (current === "normal" || current === "containment-pending")) return "active";
  if (action === "resume" && current === "active") return "normal";
  if (action === "restore" && current === "active") return "restoring";
  if (action === "quarantine" && current === "active") return "quarantined";
  throw new Error(`Invalid Coma transition: ${current} -> ${action}`);
};

export async function transitionComa(input: {
  action: ComaAction;
  cause: string;
  authority: string;
  incidentId?: string;
}): Promise<ComaState> {
  if (!input.cause.trim()) throw new Error("Coma transition cause is required");
  if (!input.authority.trim()) throw new Error("Coma transition authority is required");
  const current = await readComaState();
  const to = nextMode(current.mode, input.action);
  const at = now();
  const state: ComaState = {
    mode: to,
    incidentId: input.incidentId ?? current.incidentId,
    cause: input.cause,
    enteredAt: input.action === "enter" ? at : current.enteredAt,
    updatedAt: at,
    transitionCount: current.transitionCount + 1,
  };
  await persist(state);
  const event: ComaEvent = {
    action: input.action,
    from: current.mode,
    to,
    incidentId: state.incidentId,
    cause: input.cause,
    authority: input.authority,
    at,
  };
  await mkdir(dirname(eventPath()), { recursive: true });
  await appendFile(eventPath(), `${JSON.stringify(event)}\n`, { mode: 0o600 });
  return state;
}

export async function assertExternalActionsAllowed(): Promise<void> {
  const state = await readComaState();
  if (state.mode !== "normal") {
    throw new Error(`External actions are frozen while Cranium Coma is ${state.mode}`);
  }
}
