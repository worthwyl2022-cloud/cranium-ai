# Cranium AI

**WorthWyl presents Cranium AI** — a conversational intelligence workspace grounded in the Cranium substrate and designed for real-world research, creation, and governed product work.

## What is included

- ChatGPT-style conversational workspace with multi-model routing.
- Live research mode using current news and reference knowledge.
- GitHub grounding for the Cranium ecosystem with authority-aware sources.
- Clickable source chips and freshness-aware research context.
- Native browser voice replies and microphone input.
- Authenticated conversation and message persistence.
- Responsive dark WorthWyl interface using the supplied flame-brain mark.

## Development

```bash
pnpm install
pnpm dev
```

Run validation and production builds with:

```bash
pnpm check
pnpm test -- --run
pnpm build
```

The application uses the Manus WebDev full-stack template with React, tRPC, Express, Drizzle, and Manus authentication. Runtime configuration is supplied by the hosting environment; do not commit `.env` files or secrets.

## Product direction

Cranium is intended to become WorthWyl's real-world intelligence layer: a system that can reason across live knowledge, the Cranium substrate, user memory, governed tools, and future WorthWyl products while keeping provenance visible.
