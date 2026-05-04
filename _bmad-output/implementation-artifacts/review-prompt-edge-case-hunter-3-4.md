# Edge Case Hunter Review Prompt (Story 3.4)

Use skill: `bmad-review-edge-case-hunter`

Inputs:
- Diff: `_bmad-output/implementation-artifacts/review-3-4.diff`
- Project read access: allowed

Task:
- Walk branching paths and boundary conditions.
- Report only unhandled or under-specified edge cases.
- Output findings as Markdown list with: title, trigger condition, evidence, impact, suggested test.
