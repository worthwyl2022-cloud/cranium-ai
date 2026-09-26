# CodeQL Status

The CodeQL workflow executes successfully through analysis and scans the repository, but GitHub's CodeQL result upload is currently blocked because code scanning is disabled for this repository.

This is a repository security-setting prerequisite, not a source-code failure. The workflow requests `security-events: write` at workflow scope.

Until code scanning is enabled in repository settings, the CodeQL check may remain unsuccessful at the upload stage.
