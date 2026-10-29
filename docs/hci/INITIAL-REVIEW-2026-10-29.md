---
feature: M02 cross-cutting ORIENTAI HCI audit
source_main_sha: 71cdd40aece4ad585dc827c297d9c44f1276c354
date: 2026-10-29
review_kind: code-inspection
evidence_status: hypotheses_only_not_user_observations
---

# Initial HCI review — chat-first engineering research platform

**Scope:** source inspection of `components/v2/ChatAppShell.tsx`, `ChatStudy.tsx`, `ChatLpbfStudy.tsx`, `LpbfPhysicalSchedulePanel.tsx`, `LpbfPhysicalStackPanel.tsx`, `LpbfSensitivityPanel.tsx`, and existing M04–M07 solver documentation. No live user research, screen-reader test, mobile visual inspection or claim of WCAG compliance was performed. Recheck main SHA before implementation; these are initial *testable hypotheses*, not evidence that users failed tasks.

## Existing positive patterns to preserve
- `ChatAppShell.tsx`: chat-inspired shell with explicit "New study", "Current study", current part and research-prototype qualification; advanced tools are secondary.
- `ChatStudy.tsx`: model in conversation, dimensions/units confirmation, `role=log` chat, progress, cancel for screening and field selection; selected source result is tied to part identity and unit scale.
- `ChatLpbfStudy.tsx`: scope-specific research warnings, explicit approval checkbox, worker timeout/cancel, hashed imported scan CSV, error messages and progress.
- `LpbfPhysicalSchedulePanel.tsx`: distinguishes physical chronology audit from an actual solver run, and calls out physical layers vs virtual thermal slabs.
- `LpbfPhysicalStackPanel.tsx`: separate 1-D averaged stack worker with explicit approval and research limitation, not masquerading as 3-D melt pool.
- `LpbfSensitivityPanel.tsx`: clearly separates numerical sensitivity from experimental accuracy.

## Working mental model and tasks
Suggested user model: **Part and requirements → Suggested action → Reviewed inputs → Approved computation → Actual measured/calculated field → Limits and next action**.

Representative novice task: upload a verified public STL cube, confirm mm, identify allowable geometric screening, choose LPBF, upload a synthetic physical scan CSV, understand why a timing audit does not prove local thermal accuracy, and inspect a research-only result.

Representative specialist task: select actual scanned beam path/source hash, review material and boundary inputs, run finite-volume solver, compare numerical sensitivity, identify missing NIST validation, and export a source-traceable result.

## Code-inspection hypotheses / initial issues

| ID | Severity | Finding and grounded code evidence | Candidate change | Validation method |
|---|---|---|---|---|
| HCI-001 | S2 | `ChatLpbfStudy.tsx` presents an up-front table of many thermal parameters. Novice users may be unable to tell which values are required, which are illustrative and why they matter despite clear disclaimer text. | Basic guided panel: machine/material/scan/context first; show source and required/unknown status; allow expandable advanced parameter review. | Cognitive walkthrough and first-time engineer task |
| HCI-002 | S2 | Multiple concepts are exposed: `ChatLpbfStudy` coarse virtual slab, imported CSV for virtual slab, `LpbfPhysicalSchedulePanel` true physical layer audit and `LpbfPhysicalStackPanel` 1D full-layer averaged solver. Technically correct warnings may still demand excessive memory and distinction. | Single evidence hierarchy: "Geometry screen", "Experimental coarse thermal", "Physical scan audit", "1D averaged thermal", "Partial-layer research"; badges/copy include exactly what is *not* computed. | Misinterpretation interview; ask user what physical layer and 1-D mean |
| HCI-003 | S1 risk/hypothesis | Partial-layer `lib/lpbf-partial-layer.ts` exists without a source-verified STL slice or chat worker. Users must not mistake unrelated temperature animations for that new solver. | Block UI exposure until M04–M07; only animate actual source-hashed solver frames and show model version/scope. | Integration test + participant result-source identification |
| HCI-004 | S2 | `ChatStudy.tsx` includes a continuously incrementing 80-ms layer animation and 600-ms thermal snapshot playback. Code-inspection alone cannot confirm reduced-motion handling or whether users correctly distinguish playback from measured print speed. | Explicit "visualization playback—not realtime machine execution" notice, pause/restart, reduced-motion support and timeline timestamps. | Manual reduced-motion inspection + interpretation test |
| HCI-005 | S2 | Results rely on 3D field overlays; presence of a complete nonvisual equivalent in all routes has not been verified. `ChatStudy` exposes current fields but a focused accessibility test is required. | Tables for selected point, peak/mean, region, units, confidence/limits; keyboard path from field chooser to explanation. | Keyboard/NVDA/VoiceOver, no-WebGL mode, WCAG audit |
| HCI-006 | S2 | Some result states reset when files/processes change; risk of user not understanding why a previously calculated field disappears. In `ChatLpbfStudy.tsx` `invalidate()` clears results/approval and sets idle. | Show reason for invalidation ("units changed, prior run is stale"), retain a read-only history when appropriate, allow explicit rerun. | Browser state-transition tests and task study |
| HCI-007 | S2 | `ChatAppShell.tsx` provides "New study" immediately; user data loss/confirmation behavior requires inspection of `startUploadedProject()`, not inference. | Audit whether an unsaved case is preserved; ensure confirmation/undo if the action is destructive. | Inspect provider; browser regression with unsaved data |
| HCI-008 | S1 risk/hypothesis | AI trust calibration has not been tested. Warning copy is currently present, but a conversational AI could still sound more certain than the supported numerical evidence. | Standard output layout: `What was calculated` / `What was assumed` / `What was not assessed` / `Recommended engineer action`; copy must cite run/source ID. | Blind comprehension testing with examples and adversarial prompts |

These are proposals, not confirmed runtime defects, except the documented lack of integration of the partial-layer library (M04–M06). No severity is evidence of actual observed harm.

## Initial state transition checklist

| Action | Precondition | Feedback | Failure/cancel | Stale behavior to verify |
|---|---|---|---|---|
| Upload STL | File allowed | Model, dimensions, mesh audit | Clear invalid format/mesh error | New hash clears dependent runs |
| Confirm units | Dimensions inspected | Explicit confirmed indicator | Can correct origin/scale | Changes mark old outputs stale |
| Import scan plan | UTF-8 valid CSV | Source file/rows/hash shown | Row-level actionable registration error | Old scan run removed/archived |
| Approve physics | Parameters complete and source-linked | Approved model/assumption summary | Withdraw approval | Changing input invalidates approval |
| Run thermal study | Model/machine/process applicable | Worker progress + clear model label | Cancel and retry without fake output | Late worker response discarded |
| Interpret results | Completed matching run | Scale/unit, legend, model type, unsupported mechanisms | Non-WebGL fallback | No stale overlay on changed STL |
| Export report | Current frozen run | Exact source/model version + limitations | Error with recovery | Stale study never exported current |

## Proposed first formative task study

Recruit at least 4–6 representative participants if practical, including novice and experienced engineering users; count and skill distribution are a planning proposal only. Ask participants to complete the six steps above without instruction. Capture unassisted task success, time, retries, critical misunderstanding, navigation deviations and which risk statuses they believe are validated. Evaluate accessible tasks with keyboard-only and assistive technology manually.

**Predetermined research target:** zero participants conclude "this calculated temperature guarantees no porosity", and no participant believes a scan chronology audit is an experimentally accurate temperature simulation. A finding of confusion means UI wording/results need revision, not that unvalidated physics can be promoted.

## Review actions and owners
- **M02:** write conceptual-model + glossary for project, worker, evidence and "physical layer"; then usability interview plan.
- **M04:** document how a real STL slice differs from coarse voxel slabs with clear coverage warnings.
- **M05/M06:** add actual-input preview, approval summary, all numerical state transitions and cancellation.
- **M07/M09:** use separate numerical verification vs physical validation result cards.
- **M15:** require each AI answer to attribute claims to inputs, source documents or workers; neutral language for missing evidence.
- **M20:** perform actual user studies and accessibility tests before claiming the UX is validated.

**No user test performed, no accessibility conformance asserted, and no code changes claimed in this document.** Record implementation and retest evidence before closing findings.
