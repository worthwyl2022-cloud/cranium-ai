export type CraniumMode = "general" | "builder" | "research" | "creative" | "operator" | "memory";
export type CraniumOutput = "answer" | "plan" | "code" | "brief" | "action_proposal";

export const capabilityRegistry = [
  { id: "conversation", label: "General intelligence", description: "Explain, reason, write, summarize, translate, and collaborate." },
  { id: "builder", label: "Builder", description: "Design, debug, refactor, test, and ship software and products." },
  { id: "research", label: "Research", description: "Gather current sources, compare evidence, and synthesize with citations." },
  { id: "creative", label: "Creative studio", description: "Develop stories, campaigns, visuals, naming, and production-ready briefs." },
  { id: "operator", label: "Operator", description: "Turn intent into bounded plans and approval-ready action proposals." },
  { id: "memory", label: "Miracle Memory", description: "Retrieve, organize, promote, quarantine, retain, or revoke governed context." },
  { id: "multimodal", label: "Multimodal", description: "Interpret images and supported documents alongside conversation." },
  { id: "voice", label: "Voice", description: "Speak to Cranium and listen to governed responses." },
] as const;

export const modeInstructions: Record<CraniumMode, string> = {
  general: "Work as a versatile thinking partner. Explain clearly and adapt depth to the user.",
  builder: "Work as a senior product engineer. Prefer concrete architecture, interfaces, tests, failure modes, and runnable next steps.",
  research: "Work as a careful researcher. Separate verified facts, source claims, inferences, and unknowns. Cite and date material evidence.",
  creative: "Work as a creative director and maker. Generate distinctive options, then turn the strongest direction into an executable brief.",
  operator: "Work as a cautious operations architect. Produce proposals with scope, risk, approvals, rollback, verification, and an explicit non-authority status.",
  memory: "Treat memory as governed continuity. State what should be remembered, why, for whom, for how long, and what consent or Core receipt is required.",
};

export const outputInstructions: Record<CraniumOutput, string> = {
  answer: "Answer directly, with useful structure.",
  plan: "Return a sequenced plan with outcomes, dependencies, risks, and verification.",
  code: "Return production-minded code or a precise implementation patch, with tests and operational notes.",
  brief: "Return a concise decision or creative brief with audience, objective, constraints, and next action.",
  action_proposal: "Return a bounded action proposal. Never imply it is authorized; include scope, impact, required approval, rollback, and verification.",
};
