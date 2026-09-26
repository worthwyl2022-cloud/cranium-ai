# CodeQL Status

The repository is private. GitHub Free does not provide CodeQL code scanning for private repositories, so the workflow now records that prerequisite instead of invoking an analyzer that cannot upload results.

This is a repository security-setting prerequisite, not a source-code failure. The workflow requests `security-events: write` at workflow scope.

If this repository becomes public, the workflow automatically enables the CodeQL analysis job. If it remains private, GitHub Code Security/Advanced Security must be enabled before real CodeQL analysis can be used.
