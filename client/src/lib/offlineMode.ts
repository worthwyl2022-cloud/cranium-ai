export type ConnectivityState = "online" | "offline";

type Listener = (state: ConnectivityState) => void;

let state: ConnectivityState = typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline";
const listeners = new Set<Listener>();
let initialized = false;

function emit(next: ConnectivityState) {
  if (state === next) return;
  state = next;
  listeners.forEach(listener => listener(state));
}

export function getConnectivityState(): ConnectivityState {
  return state;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && !initialized) {
    initialized = true;
    window.addEventListener("online", () => emit("online"));
    window.addEventListener("offline", () => emit("offline"));
  }
  return () => listeners.delete(listener);
}
