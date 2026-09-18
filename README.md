# Convertible Cranium AI

**WorthWyl presents Convertible Cranium AI** — a conversational intelligence workspace grounded in the Convertible Cranium substrate and designed for real-world research, creation, and governed product work.

## What is included

- ChatGPT-style conversational workspace with multi-model routing.
- Live research mode using current news and reference knowledge.
- GitHub grounding for the Convertible Cranium ecosystem with authority-aware sources.
- Clickable source chips and freshness-aware research context.
- Native browser voice replies and microphone input.
- Authenticated conversation and message persistence.
- Responsive dark WorthWyl interface using the supplied flame-brain mark.

## Permanent Convertible Cranium boundary

Convertible Cranium AI is the product and cognition layer. It may route model requests, retrieve
research, present source-aware context, retain authenticated conversations, and propose
responses or actions. It does not grant authority, commit governed state, invoke protected
tools, or issue authoritative receipts. Those responsibilities belong to Convertible Cranium Synapse
and the canonical `cranium-kernel` authority boundary.

Every response is associated with a versioned context envelope. The envelope binds a
correlation identifier, policy version, request hash, source provenance, source authority
classification, retrieval time, evidence class, uncertainty, and a SHA-256 content hash.
Governed response receipts carry the envelope hash. Persisted assistant messages retain the
correlation identifier and envelope hash for later review.

## Development

```bash
pnpm install
pnpm dev
```

Run validation and production builds with:

```bash
pnpm run check
pnpm test
pnpm run build
pnpm audit --audit-level high
```

The application uses the Manus WebDev full-stack template with React, tRPC, Express, Drizzle, and Manus authentication. Runtime configuration is supplied by the hosting environment; do not commit `.env` files or secrets.

## Product direction

Convertible Cranium is intended to become WorthWyl's real-world intelligence layer: a system that can reason across live knowledge, the Convertible Cranium substrate, user memory, governed tools, and future WorthWyl products while keeping provenance visible.
