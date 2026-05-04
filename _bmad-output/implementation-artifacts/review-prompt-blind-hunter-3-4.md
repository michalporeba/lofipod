# Blind Hunter Review Prompt (Story 3.4)

Use skill: `bmad-review-adversarial-general`

Rules:
- You receive DIFF ONLY.
- Do not assume project context or spec.
- Find concrete bugs, regressions, risky behavior, and incorrect assumptions.
- Output findings as a Markdown list with: title, severity, evidence (file/line from diff), and impact.

Diff to review:
- File: `_bmad-output/implementation-artifacts/review-3-4.diff`
- Target commit: `12e7e0b` (`unsafe remote edits`)
