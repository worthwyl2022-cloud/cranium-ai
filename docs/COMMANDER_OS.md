# Convertible Cranium Commander OS

Commander OS is the operator-facing environment for Convertible Cranium. The current implementation uses the existing Cranium AI runtime as its native intelligence interface rather than creating a second AI implementation.

## Surface model

- Commander OS: operating environment and user-facing control surface.
- Cranium AI: shared cognitive runtime and interaction layer.
- Cranium Kernel: canonical authority source.
- Synapse: bounded evidence and assessment interface.
- Miracle Memory: continuity and memory plane.
- Session Circuit Breaker: runtime safety and recovery.

The Commander AI profile may explain and guide operations, but it never becomes authoritative by virtue of generating text. Any future privileged transition must cross the authenticated Kernel boundary.

## Runtime profile

Build the normal Cranium AI application with VITE_CRANIUM_SURFACE=commander. This changes the UI labels, welcome experience, starter prompts, and server system profile while preserving the underlying model routing and governance pipeline.

## ChromiumOS strategy

The immediate target is a Chrome/ChromiumOS-friendly application surface. A full ChromiumOS fork is a later platform integration task, not a prerequisite for validating Commander. ChromiumOS development requires a dedicated Linux environment and substantial disk/RAM capacity, so the platform tree should be introduced separately from the application runtime.

Expected boundary: ChromiumOS foundation -> Commander system surface -> Cranium services -> Kernel authority.
