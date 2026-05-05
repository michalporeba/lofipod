# Edge Case Hunter Review Prompt

Use skill: `bmad-review-edge-case-hunter`

## Scope
Review this diff with read access to the project.

## Diff
`_bmad-output/implementation-artifacts/review-prompts/4-4.diff`

## Task
Find unhandled branching paths, boundary conditions, and state-machine edge cases.
Output findings as a Markdown list.
Each finding must include:
- One-line title
- Severity (`high|medium|low`)
- Edge case scenario
- Evidence (file path + behavior)
- Expected vs actual behavior
- Minimal fix direction

Prioritize deterministic migration behavior, idempotency across restarts, sync ordering, and failure-state surfacing.
