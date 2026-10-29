# ORIENTAI — HCI/Human-Factors Review Protocol

**Status:** Project-specific Markdown methodology and release-quality checklist, introduced 2026-10-29. These are planned tests; actual testing requires recorded observations.

**Use for:** every interface, worker approval, model visualization, AI prompt, report and error flow. This is authored for ORIENTAI, inspired by the [45ck HCI Review Skill Pack](https://github.com/45ck/hci-review-skill) but not an imported third-party agent executable. Do not run external install scripts or copy external skills without review.

## A. Human-centered design problem

The engineer must reliably distinguish: (a) uploaded actual part vs example; (b) part coordinates vs build/machine coordinates; (c) geometry screen vs numeric approximation vs experimentally validated prediction; (d) assumed properties vs cited material card; (e) worker status vs final engineering decision; (f) manufacturing process vs service loading.

Users: novice student engineers, experienced mechanical/additive manufacturing engineers, simulation specialists, technical reviewers. Test actual users rather than inventing interview findings. The AI should reduce input burden but NEVER substitute confident language for uncertainty, unsupported data or engineering approval.

### Proposed conceptual model (to validate with engineers)

1. **Project / part:** one current revision, source hash, confirmed units and context.
2. **Questions:** missing material, loads, constraints, process, machine, postprocessing; why a question matters.
3. **Plan:** which analyses are applicable, what will be calculated, time/resource cost, evidence limits.
4. **Approval:** reviewed assumptions, privacy/transfer consent and explicit start.
5. **Run:** progress, cancel, visible provenance; no fake stages or predetermined outputs.
6. **Results:** actual geometry + linked evidence/fields + units, ranges, uncertainty and validation status.
7. **Alternatives:** compare only evidence-supported candidates and unknown blockers.
8. **Review/export:** reproducible record and action items; never "certified" or "safe to print" from research calculations.

A user can return to a stage without silently losing inputs; any changed dependency marks only affected results stale.

## B. Six reusable Markdown HCI reviews

Store completed records in `docs/hci/reviews/YYYY-MM-DD-<feature>.md` with an evidence/verification tag.

### HCI-1 — Conceptual model and information architecture
- User goal, professional vocabulary, actual entities (part, revision, study, assumption, evidence, requirement, result).
- Primary task, entry point, location of next action, part visibility, whether reports use same case.
- Identify cross-screen duplications, confusing "demo" vs "actual" labels and orphaned tools.
- Output: simple journey graph and glossary; record model/real-world mismatches.

### HCI-2 — State model and failure-path audit
Write each action's states: `idle → missing-input → ready → approved → queued/running → completed | failed | cancelled | stale`.
For every transition document trigger, visible feedback, screen-reader feedback, reversibility, user correction, worker lifetime, data persistence and whether an action is allowed. Specifically simulate: invalid STL, ambiguous units, unregistered laser path, missing material card, unavailable AI service, timeout, part switch during run, stale export, browser reload, upload containing confidential data.
- Output: transition table + error recovery tests. Never leave a spinner forever or show a prior result as current.

### HCI-3 — Cognitive walkthrough and copy audit
Walk through without prior training:
- What does the engineer want to accomplish?
- Can they see which action enables it?
- Can they identify the correct control?
- Do they understand feedback and why it matters?
- Can they distinguish `coarse virtual slab`, `physical printed layer`, `1D averaged temperature`, `thermal voxel` and `experimental measurement`?
- Are inputs reused rather than repeatedly requested, and unknown parameters surfaced at the moment needed?
- Output: observed/reviewed friction with wording alternatives, risk severity and source location.

### HCI-4 — Heuristic evaluation
Apply [Nielsen Norman Group's 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), focusing on status visibility, real-world technical meaning, control/cancel, consistency, error prevention, recognition over recall, expert shortcuts, minimalism, actionable error recovery and contextual help.
Use original text and explain each severity finding, not just a numeric score. Severity guidance:
- S0 critical: can lead to unsafe/unsupported engineering conclusion, unauthorized data transfer or unapproved action.
- S1 major: blocks a required task, misrepresents status, causes loss of work, or makes essential workflow inaccessible.
- S2 moderate: high effort, confusing wording, repeated entry, hard to find next action.
- S3 minor: polish, low-impact consistency issue.

### HCI-5 — Accessibility and inclusive 3D scientific visualization
Target **WCAG 2.2 AA** for authored web application journeys, with manual and automated verification. Important criteria relevant to ORIENTAI include:
- 1.1.1 text alternatives; 1.3.1 semantics/relations; 1.4.1 non-color-only meaning; 1.4.3 contrast; 1.4.10 reflow; 1.4.11 non-text contrast.
- 2.1.1 keyboard; 2.1.2 no keyboard trap; 2.4.3 logical focus order; 2.4.7 visible focus; 2.4.11 focus not obscured; 2.5.7 alternatives to dragging; 2.5.8 target size.
- 3.3.1 input error identification; 3.3.2 labels/instructions; 3.3.3 corrections; 3.3.7 avoid redundant entry; 4.1.3 status announcements.
Checks: keyboard-only chat/upload/approval/run/cancel/export; VoiceOver/NVDA where available; zoom 200% and mobile 320px equivalent; reduced motion; meaningful legend and units; table of measured field samples/selected coordinates and risk areas; no reliance on heatmap colors alone. A canvas/3D view is supplementary, not the only way to access a result.

Automated tools (e.g. Playwright/axe where installed) detect only some defects. Human evaluation and assistive-tech tests are required before claiming conformance. Record tested URLs/browser/assistive-tech versions and failures.

### HCI-6 — Representative task study and quantitative reporting
Prepare a task/script without coaching the participant. Suggested core tasks:
1. Upload a non-controlled bracket and verify its units and size.
2. Explain component purpose and mark a missing service load as unknown.
3. Select LPBF and evaluate which process inputs are assumptions vs sourced.
4. Import an intentionally shifted scan CSV and explain the registration problem.
5. Approve a research simulation, follow progress and cancel one run.
6. Interpret a thermal field and identify what it **does not** say about defects.
7. Compare two candidate orientations under a hard constraint.
8. Export a reproducible review record and identify an unassessed failure mode.

Record: number of participants, skill mix, task success definition, completion time, errors, assists, critical misunderstandings, trust calibration, subjective usefulness, and severity. Proposed *pilot thresholds* (adjust before testing, not after): >=90% unassisted completion for core tasks, zero unsupported "qualified" interpretations, zero high-severity data or approval errors, all participants can identify uncertainty and modeled scope. These are aspirational gates, not measured results. Repeat after changes and report failures honestly.

## C. Design rules for actual ORIENTAI components

- **Chat is the primary control surface**: the user can write natural language, attach a part/document, choose a suggested next action, approve and see outcomes. Never claim the LLM has performed an analysis before a verified worker returns its result.
- **Real part stays in view**: show filename, actual geometry identity and dimensions; expandable 3D viewer, restore focus to chat. On mobile avoid the model covering or displacing controls.
- **Progressive disclosure**: basic study setup asks only for missing essential context; deep parameter tables are optional advanced panels. Mandatory assumptions are still reviewable.
- **Evidence hierarchy**: screen/field/result must show `screened`, `calculated / unvalidated`, `validated within scope` or `not assessed`; every heatmap includes units, numerical range, source run and supported scope.
- **Prevention over warnings**: a user cannot run a physical-layer solver on an unverified/ambiguous STL slice or mismatched scan without a blocking explanation. Disable controls with an accessible reason.
- **Recoverability**: cancellation stops workers; error messages explain a precise repair step; stale results are visibly obsolete and excluded from reports; no hidden auto-retry with changed assumptions.
- **No misleading animation**: label illustrative build preview vs actual numerical timesteps; do not imply melted metal from heuristic color transitions or an artificially smooth beam spot.
- **Engineer control**: AI requests permission for external geometry/document transfer, significant compute and model assumption changes; engineer remains decision owner.
- **Accessible fallback**: tabular and text explanations of solver values, sampled locations, errors and anomalies must function without 3D/WebGL/animation.

## D. Every HCI review document must include

```markdown
---
feature: Mxx / short name
source_main_sha: <audited SHA>
date: YYYY-MM-DD
review_kind: code-inspection | heuristic | walkthrough | user-study | accessibility-test
reviewer: <role>
evidence_status: planned | observed | retested
---
# User goal and workflow
# Conceptual model and task steps
# State/failure path table
# Findings (ID, severity, observed evidence, proposed fix, owner, status)
# Accessibility test matrix (method, criterion, result)
# Usability metrics (participants, task success, time, errors, comprehension)
# Unresolved safety/engineering interpretation risks
# Test evidence and links
# Decision / release blockers
```

**Critical separation:** code-based inspection is a hypothesis about user behavior; a usability claim requires observed participant data. A screenshot is not a numerical verification. An automated accessibility scan cannot establish full WCAG compliance.

## E. Release HCI gates

**R1:** every principal task has a recorded walkthrough, keyboard/assistive-tech verification where feasible, actionable failure paths and an actual small formative usability round with recorded results; no S0/S1 unresolved on core tasks. No success claim from a heuristic-only review.

**R2:** in addition, engineers can correctly distinguish uncertainty, physical vs heuristic models, validation scope and not-assessed risks in blinded interpretation tasks. A misleading thermal animation is a release blocker even if its calculations are correct.

**R3:** access/permission UX, irreversible controls, deletion, privacy consent, audit/approval trail and varied user roles evaluated under representative operational conditions.

## References

- Project master roadmap: [../MASTER-MILESTONE-ROADMAP.md](../MASTER-MILESTONE-ROADMAP.md)
- Optional external Markdown approach (reviewed, not installed): https://github.com/45ck/hci-review-skill
- NN/g 10 heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C human accessibility evaluation: https://www.w3.org/WAI/test-evaluate/
