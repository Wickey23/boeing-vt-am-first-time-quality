---
name: orientai-hci-review
description: Review ORIENTAI engineering workflows for human factors, scientific trust calibration, error recovery, accessibility, and evidence-grounded chat/3D interaction. Use for any new or edited user-facing part upload, AI copilot, approval, solver, visualization, or reporting flow.
---

# ORIENTAI HCI / Human Factors Review Skill

Before reviewing any component, read:
- `docs/MASTER-MILESTONE-ROADMAP.md`
- `docs/hci/ORIENTAI-HCI-PROTOCOL.md`
- `docs/hci/INITIAL-REVIEW-2026-10-29.md`
- Fresh `AGENTS.md`, current `main`, latest commits/PRs and the specific source components.

This is an ORIENTAI-authored Markdown review aid inspired by the [public HCI Review Skill Pack](https://github.com/45ck/hci-review-skill), not a vendored copy or script. It must not execute downloaded install scripts, infer user research from code, or promote an unvalidated solver into a qualified engineering result.

## Trigger

Run this before and after any user-facing change that affects onboarding, document/part import, engineering interview, approval, simulation progress, results, model viewer, risk screens, alternative comparison or exports.

## Review sequence

1. **User task:** identify novice and expert engineering goals, entry point, success evidence and missing decisions. The task should use the actual uploaded part, not a silent example.
2. **Conceptual model:** map source geometry, revisions, assumptions, machine/process, analysis run and evidence; flag conflicts with engineer mental models.
3. **State machine:** specify transitions for idle/missing input/ready/approved/running/completed/failed/cancelled/stale and response to wrong part hashes, bad units, timeout and no-WebGL.
4. **Cognitive walkthrough:** describe what user sees and believes after each major action. Look for wrong conclusions about physical slices, coarse virtual slabs, 1D layer-average, validation and defect claims.
5. **Heuristic review:** review status visibility, recognition vs recall, user control, consistent words, error prevention, recovery and minimalism. Use severity S0–S3 from protocol.
6. **Accessibility precheck:** verify semantic labels, focus order, keyboard usage, announcements, WCAG 2.2 AA target, color-independent legends, reduced-motion and text/table fallback for 3D. Mark anything not manually tested as NOT TESTED, not pass.
7. **Interaction tests:** add or propose browser tests covering active part identity, approval, lossless cancellation, stale state, input errors and correct result provenance.
8. **Evidence and release:** save a new dated Markdown review in `docs/hci/reviews/`, including findings, source locations, what was actually executed, artifacts, severity and clear next actions. Reference the milestone ID and `docs/MILESTONE-TRACKER.md`.

## Output template

```markdown
---
feature: Mxx / name
source_main_sha: <sha>
date: YYYY-MM-DD
review_kind: code-inspection | walkthrough | accessibility-test | user-study
evidence_status: planned | observed | retested
---
# User, task and success
# Workflow and mental-model map
# Approval/worker/result state graph
# Findings: issue, severity, evidence, repair, retest
# Accessibility: criterion, method, status
# Usability metrics (only if actual participants were studied)
# Scientific misinterpretation risks
# Tests run and unresolved blockers
```

## Hard stops

- Never substitute source-code inspection for real participant test findings.
- Never assert WCAG compliance from automation alone.
- Never treat an animation as a measured physical build.
- Never use AI-generated confidence to claim qualified material properties, prints, strength, porosity probability or first-time yield.
- Never remove approval gates or provenance warnings to make a screen simpler.
- Never claim files were committed, tests passed or a version deployed unless those results were checked.

## References

- https://www.w3.org/TR/WCAG22/
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.w3.org/WAI/test-evaluate/
