# Monthly Maintenance and Evolution Cycle

GitHub Actions runs the maintenance cycle on the first day of every month at 03:00 UTC and also supports manual dispatch. The cycle verifies the Constitution hash, checks capability permissions, runs the TypeScript check, executes regression tests, builds the production bundle, and uploads a JSON maintenance report as an artifact.

A failed check produces a `read-only-safe` report and a failed workflow. The runner does not silently rewrite source, rotate credentials, alter permissions, change the Constitution, publish externally, or deploy an unreviewed candidate.

The current evolution scope is intentionally limited to prompt wording, pronunciation mappings, UI polish, regression tests, and non-security documentation. Proposed changes outside that scope are quarantined for the owner approval path. A future executor may apply allowlisted changes only after it has a signed approval receipt, a candidate fingerprint, passing evaluations, and a rollback target.

Configure `CRANIUM_CONSTITUTION_SHA256` as a repository or environment secret. Keep the repository workflow permission at read-only until a separate, least-privilege executor and release-signing workflow are in place.
