# Convertible Cranium Commander

Convertible Cranium Commander is the operator-facing surface for the Convertible Cranium Chromium Edition. The current implementation uses Convertible Cranium AI as its native intelligence interface rather than creating a second AI implementation.

## Surface model

- Convertible Cranium Commander: operator-facing control surface.
- Convertible Cranium AI: shared cognitive runtime and interaction layer.
- Convertible Cranium Kernel: canonical authority source.
- Convertible Cranium Synapse: bounded evidence and assessment interface.
- Miracle Memory: continuity and memory plane.
- Session Circuit Breaker: runtime safety and recovery.

The Convertible Cranium Commander profile may explain and guide operations, but it never becomes authoritative by virtue of generating text. Any future privileged transition must cross the authenticated Kernel boundary.

## Runtime profile

Build the normal Convertible Cranium AI application with VITE_CRANIUM_SURFACE=commander. This changes the UI labels, welcome experience, starter prompts, and server system profile while preserving the underlying model routing and governance pipeline.

## ChromiumOS strategy

The immediate target is a Chrome/ChromiumOS-friendly application surface. A full ChromiumOS fork is a later platform integration task, not a prerequisite for validating Commander. ChromiumOS development requires a dedicated Linux environment and substantial disk/RAM capacity, so the platform tree should be introduced separately from the application runtime.

Expected boundary: ChromiumOS foundation -> Convertible Cranium Commander surface -> Convertible Cranium services -> Convertible Cranium Kernel authority.
