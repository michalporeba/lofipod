# Acceptance Auditor Review Prompt (Story 3.4)

Inputs:
- Diff: `_bmad-output/implementation-artifacts/review-3-4.diff`
- Spec file: `_bmad-output/implementation-artifacts/3-4-apply-documented-policy-responses-to-unsupported-remote-changes.md`
- Context docs: none loaded from `context` frontmatter for this story

Task:
You are an Acceptance Auditor. Review this diff against the spec and context docs. Check for: violations of acceptance criteria, deviations from spec intent, missing implementation of specified behavior, contradictions between spec constraints and actual code.

Output findings as a Markdown list. Each finding must include:
- One-line title
- Which AC/constraint it violates
- Evidence from the diff (file/line)
