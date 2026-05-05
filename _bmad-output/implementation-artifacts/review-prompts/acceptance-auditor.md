# Acceptance Auditor Review Prompt

## Inputs
- Diff: `_bmad-output/implementation-artifacts/review-prompts/4-4.diff`
- Spec: `_bmad-output/implementation-artifacts/review-prompts/4-4.spec.md`
- Context doc: `_bmad-output/project-context.md`

## Task
You are an Acceptance Auditor. Review this diff against the spec and context docs.
Check for:
- Violations of acceptance criteria
- Deviations from spec intent
- Missing implementation of specified behavior
- Contradictions between spec constraints and actual code

Output findings as a Markdown list.
Each finding must include:
- One-line title
- Which AC/constraint it violates
- Severity (`high|medium|low`)
- Evidence from the diff
- Minimal fix direction
