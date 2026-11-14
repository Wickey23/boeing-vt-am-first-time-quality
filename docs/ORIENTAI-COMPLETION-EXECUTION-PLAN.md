# ORIENTAI — Completion execution plan
**Baseline:** 2026-11-14. **Owner:** VT ISE senior-design team. **Product:** LPBF pre-build engineering assessment; IN718 first experimental prediction scope.

This is an execution/acceptance tracker, **not** a claim that all systems are implemented or scientifically validated. Verify each gate at the current SHA. No Boeing-controlled drawings or data in this public repository. Team code requires PR review when overlaps are present; never force-push or merge a conflicted PR.

## Definition of done: three independent gates

- **R1 / Senior-design prototype:** A first-time engineer can complete `STL upload → units/geometry → context → explainable rule checks → action plan → evidence PDF` unaided using a public test part. Exact source/parameter provenance, explicit unknowns and reproducible outputs. Numerical unit tests, typecheck, production build, browser tests, usability and accessibility review green **on the same release SHA**; Vercel routes verified and documented. No unvalidated defect probability or build approval.
- **R2 / Bounded physically validated pilot:** One specified material/condition (start IN718), machine/process revision and failure mechanism, matched experimental data, independent build-held-out measurements and uncertainty, frozen metrics and explicit applicability/abstention gate. Geometry/slice, thermal and distortion reference errors characterized. Distinct pass/fail limits set *before* evaluation.
- **R3 / Production platform:** Organization-approved data classification, authenticated users, tenant isolation, durable jobs/storage, security review, uptime/rollback, documented ownership, qualified operating limits and explicit authority for deployment/use. R1 or R2 does not imply aerospace certification.

## Ordered work packages and acceptance gates

| ID | Priority | Status 2026-11-14 | Deliverable / completion evidence | Dependency |
|---|---|---|---|---|
| UX-01 | P0 | In progress | Upload-first homepage, compact geometry review, context instructions, actionable results; no confusing duplicate navigation | current main + PR #18 reconciliation |
| REL-01 | P0 | **Blocked: CI browser failures** | Fix tests for intentionally collapsed export; all E2E, numerical, typecheck, build green on **same SHA** | UX-01 |
| UX-02 | P0 | Not independently verified | 3–5 unaided novice walkthroughs: upload, correct units, enter use, analyze, find action/export; record mistakes, completion and time; keyboard/mobile/a11y checks | REL-01 |
| GEO-01 | P0 | Implemented bounded research path | Real STL mesh audit + unit/rotation/placement identity; cube/sleeve/thin wall/bracket golden cases, error and convergence budgets; fail closed | M03/M04 |
| RULE-01 | P0 | Implemented baseline | Geometric envelope/support preflight, machine/material process-window provenance; severity with source, region and actionable remedy; synthetic regression cases | GEO-01 |
| CTX-01 | P0 | Partial | Component function, attachments, loading and optional document evidence tied to source and part hash; edits invalidate stale claims | UX-01 |
| REPORT-01 | P0 | Partial | One reproducible report with screened vs unassessed, source hashes, assumptions, action plan, limitations and export test | RULE-01, CTX-01 |
| SLICE-01 | P1 | Sampled implementation, not exact CAD slicing | Layer-section area/volume, occupancy and geometry error on fixtures; reject ambiguous and under-resolved physical geometry | GEO-01 |
| SCAN-01 | P1 | Geometric registration available | Source-identified scan path with layer/XY alignment, chronology and rejection tests; no claim machine file verified | SLICE-01 |
| THERM-01 | P1 | Bounded experimental numerical solver | Mesh/time-step refinement, conservation diagnostics, benchmark matching with stated boundary conditions; full/partial-cell fidelity reviewed | SCAN-01 |
| DIST-01 | P1 | Not validated | Independently measured IN718 part displacement field vs distortion model with predeclared MAE/RMSE and reference frame | THERM-01 + actual metrology |
| DATA-01 | P1 | Catalog and downloader **only** | Download NIST original bytes, capture SHA/license/units/machine/specimen IDs, archive untouched and parse clean typed measurements | Network access + source review |
| ML-01 | P1 | Not trained | IN718 measured melt-pool dimensions predictor; baseline comparison, build-held-out test, uncertainty and source provenance | DATA-01 |
| DEF-01 | P1 | Not trained | Inspection-defined lack-of-fusion labels from compatible builds; freeze threshold, train mechanism-specific model, report calibration, precision/recall/false alarms/coverage | DATA-01 + defect ground truth |
| VIZ-01 | P1 | Partial geometric highlighting | Click actual observed/screened part regions, distinguish predicted/unknown categories, link to evidence; no fabricated heat maps | RULE-01 + validated models |
| AI-01 | P1 | Partial | Document-grounded explanations, controlled AI authorization, cited assumptions; clear deterministic fallbacks and tests | CTX-01 |
| FEED-01 | P2 | Partial | Attach independent build/CT/measurement outcomes to specific source/job/procedure, feedback without data leakage | DATA-01 |
| OPS-01 | P2 | Partial research | Immutable study/run IDs, durable storage, isolation, rate/size controls, recovery, deployment/rollback and monitoring | R1 |
| DED-01 | Optional | Unmerged PRs #8/#9 | Keep DED/Simio and queue models distinct from LPBF prediction claims; decide review/merge separately | Team decision |
| REL-02 | P0 gate | Not reached | Demonstrate one full study from an approved public STL on production and attach CI SHA, browser run, report artifact and reproducibility record | all R1 P0 |

## Immediate sequence (each change must be independently releasable)

1. **Resolve current E2E contract drift** from collapsing the report export: browser tests open the export disclosure before checking enabled/disabled state; do not weaken authorization tests. Then verify numerical/typecheck/build/E2E run on the same commit.
2. **Confirm real production state**: compare Vercel deployed SHA with green CI SHA; test `/`, `/copilot/workbench`, `/defect-evidence`, exported PDF and mobile path. Preserve existing route redirects.
3. **Run a supervised public-STL walkthrough** with recorded inputs, invalid mesh, correct/incorrect units, no-doc path, partial evidence and one reviewed reference. Capture HCI issues.
4. **Run NIST downloader on network-capable runner**; review source rights and structure before any transformation. Build one source-hashed parser test.
5. **Train only a measurement-target predictor** after data review, then independently define defect labels if available. Keep resulting model explicitly bounded and abstaining outside supported conditions.
6. **Recheck numerical solvers** against reference geometry and independent thermal/distortion measurements. Expand only where errors and model assumptions are quantified.
7. **Close R1**, then assess R2 or R3 separately. Do not call R2 complete just because R1 passed.

## Evidence checklist for each work package
- Source commit, changed files, reviewer/PR overlap, required user approval.
- Actual commands and results: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`.
- Sample/model/material/machine identity; provenance and SHA-256 for any measurements.
- Baseline vs candidate metrics, held-out independence and failure/abstention cases.
- Current deployed SHA and smoke-test result (or **not verified**).
- Next blocker, owner and explicit reason a claim is not yet allowed.

## Baseline CI evidence
Earlier commits passed numerical tests and builds, but recent UI changes led to E2E failures including a geometry height regression and legacy PDF button tests when exports moved into `<details>`. The last inspected release head had **no confirmed all-green full suite or Vercel deployment**. Always inspect current GitHub Actions again, not this snapshot.

## Key resources
- [Master milestone roadmap](MASTER-MILESTONE-ROADMAP.md) — detailed M00–M20 contracts.
- [Milestone tracker](MILESTONE-TRACKER.md) — older Oct 29 baseline, must be updated with new evidence.
- [LPBF defect validation protocol](LPBF-DEFECT-PREDICTION-VALIDATION.md).
- [NIST acquisition guide](NIST-LPBF-DATA-ACQUISITION.md).
- [GitHub Actions](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions).
