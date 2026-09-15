# Cranium Owner Control

The owner control plane is a documented, signed recovery channel for **William (Wyl) Mathes — 508022573**. It is not a hidden backdoor and it does not contain destructive self-erasure behavior.

## Accepted actions

The endpoint accepts an allowlisted owner command: `PAUSE`, `SAFE_MODE`, `RESTORE_SIGNED_VERSION`, `REVOKE_CREDENTIALS`, `FREEZE_EXTERNAL_ACTIONS`, `APPROVE_MAJOR_CHANGE`, `REJECT_CHANGE`, `ROTATE_KEYS`, or `EXPORT_AUDIT`.

Each command must include a unique ID, the exact owner identity, an ISO timestamp within five minutes of receipt, an action, and a reason. The canonical JSON body is signed with the owner’s private key. The server verifies the signature against `CRANIUM_OWNER_CONTROL_PUBLIC_KEY`, rejects replayed IDs, and appends accepted and rejected events to a JSONL audit log.

## Deployment requirements

Store the private signing key only in the owner’s hardware-backed password manager or security key. Never commit it to GitHub, the app, a browser bundle, chat history, or an environment file shared with developers. Configure only the public key in the deployment environment:

```text
CRANIUM_OWNER_CONTROL_PUBLIC_KEY=<owner public key in PEM format>
CRANIUM_CONSTITUTION_SHA256=f34355548ab98f39c5d0d20b1241969c5ab7eb1e1d80b04fefd7f64b7535b6e8
```

The current endpoint is `POST /api/owner-control`. It returns `503` until the public key is configured. A successful response means the signed command was authenticated and recorded; a separate controlled executor must perform the action and write a deployment or recovery receipt.

## Hardening roadmap

The next production-hardening steps are to move the audit log to append-only external storage, replace in-memory replay tracking with durable storage, use a hardware-backed signing key with rotation and revocation, add a separate executor for each allowlisted action, require two-person review for credential rotation, and place the endpoint behind a separate control-plane host or private network. The owner key should be protected by a contractual and operational recovery process.

GitHub reported that protected branches require a paid plan for this private repository. Until repository rulesets or an external deployment gate are available, the signed control plane and constitutional hash are application-level controls, not a guarantee against a repository administrator replacing the server itself.
