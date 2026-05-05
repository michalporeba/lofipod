# Blind Hunter Review Prompt

Use skill: `bmad-review-adversarial-general`

## Scope
Review ONLY this diff. No project context, no spec context, no repository browsing.

## Diff
`_bmad-output/implementation-artifacts/review-prompts/4-4.diff`

## Task
Perform an adversarial code review and return findings as a Markdown list.
Each finding must include:
- One-line title
- Severity (`high|medium|low`)
- Evidence (file path + specific behavior from diff)
- Why it is a defect/risk
- Minimal fix direction

Focus on correctness, regressions, reliability, edge behavior, and trust/safety contract violations.
