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

## Verified engineering review — 2026-11-15 (evidence-only update)

- **Repository head at review:** `472ad5620ed3c2369f2630c0782b9bc2a349a2f8` (automatic ticker commit). Most recent substantive change: `8673952e472e`, descriptive CMU CT specimen-level pore summaries. The head's ticker is **not** an engineering validation result.
- **CI evidence:** [ORIENTAI numerical and build checks, run 43655403255](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43655403255), for `8673952e472e`, completed **success**. Its engineering job explicitly passed numerical regressions, TypeScript, Next.js production build and shared-workspace browser regression. [ML provenance and reproducibility, run 43655403143](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43655403143) and [CMU CT source audit, run 43655403079](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43655403079) also completed success for that commit. These checks do **not** prove prediction accuracy, source-label validity or live production deployment.
- **Team overlap:** Open PRs [#20](https://github.com/Wickey23/boeing-vt-am-first-time-quality/pull/20) (X-ray/build-height viewer), [#18](https://github.com/Wickey23/boeing-vt-am-first-time-quality/pull/18) (workbench redesign), [#9](https://github.com/Wickey23/boeing-vt-am-first-time-quality/pull/9) (DED specification) and [#8](https://github.com/Wickey23/boeing-vt-am-first-time-quality/pull/8) (queue simulation). GitHub's mergeability assessment is time-dependent: #18 and #8 were reported non-mergeable in this review. No PR was merged or force-pushed. Review changed files and refresh mergeability before any integration.
- **Deployment evidence:** Vercel production commit identity, successful live route smoke tests and PDF artifact were **not independently verified** during this review. Do not infer production deployment from green CI.
- **Data/ML boundary:** Recent CMU CT work provides descriptive specimen-level pore summaries and provenance checks, **not** verified IN718 defect labels or a qualified defect predictor. NIST source downloads, unit/identity review, independent-build test splits and predefined abstention criteria remain outstanding.
- **Next acceptance action:** Capture a Vercel deployment SHA and smoke-test `/`, `/copilot/workbench`, `/defect-evidence` and PDF export against that SHA; retain a public-STL test record. Then audit source-verified IN718 measurements without inferring defect labels from melt-pool geometry.

## Key resources
- [Master milestone roadmap](MASTER-MILESTONE-ROADMAP.md) — detailed M00–M20 contracts.
- [Milestone tracker](MILESTONE-TRACKER.md) — older Oct 29 baseline, must be updated with new evidence.
- [LPBF defect validation protocol](LPBF-DEFECT-PREDICTION-VALIDATION.md).
- [NIST acquisition guide](NIST-LPBF-DATA-ACQUISITION.md).
- [GitHub Actions](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions).


## Verified engineering review — 2026-11-16 (PDF export regression and deployment identity)

- **Source review:** Before changes, `main` was `0d20e8641122768d498759bc39b4dbc9169c89c3`. Open PRs #20 (viewer, clean), #18 (workflow redesign, conflicted), #9 (DED specification, clean), and #8 (queue simulation, conflicted) were inspected; this change does not touch their application files. No PR merged or force push performed.
- **Small isolated test improvement:** [`eaf4e030d4dc`](https://github.com/Wickey23/boeing-vt-am-first-time-quality/commit/eaf4e030d4dc45d18ed3cc61510222371992e79d) extends `tests/browser/document-optional-assessment.spec.ts` to exercise **actual assessment PDF export** after the guided STL → context → risk workflow, assert the downloaded filename ends in `.pdf`, check the PDF magic header `%PDF-`, and require >1000 bytes. Previously this path checked only the presence/enabled state of the export control. It uses the existing public 10-mm verification cube, not Boeing CAD.
- **CI:** [Engineering run 43946521017](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43946521017) was **in progress** when this evidence entry was authored; do not call the new test passing until the run finishes. Prior engineering run [43759025504](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43759025504) for `0d20e8641122` completed successfully.
- **Production deployment identity (Vercel API):** Production alias `boeing-vt-am-first-time-quality-wickey23s-projects.vercel.app` resolved to deployment `dpl_3istBwPb1wp3NWPQSf8F2FofpVeH`, `READY`, `target=production`, source `main`, commit `0d20e8641122768d498759bc39b4dbc9169c89c3`. This verifies **deployed commit identity**, not a route smoke test, browser execution, PDF generation, or deployment of `eaf4e030`.
- **Remaining release evidence:** Confirm the new test's CI result, verify that production advances to the tested SHA, smoke-test `/`, `/copilot/workbench`, `/defect-evidence` and mobile layout, and retain a real downloaded report artifact. Public NIST IN718 source units/IDs and independently validated labels remain outstanding; no model was trained and no physical defect probabilities were claimed.


## Verified engineering review — 2026-11-17 (PDF integrity regression)

- **Pre-change main:** `a8ebb089804d16e330e5b1a3374be053b553c458`. Reviewed the latest commits, existing guided workflow/PDF test, and four open PRs: #20 (viewer-only, clean), #18 (workbench redesign, dirty), #9 (DED documentation, mergeability pending), and #8 (manufacturing queues, mergeability pending). No PR merged or force-pushed. The isolated change touches neither the viewer nor PR branch files.
- **Small test improvement:** Commit [`d6d6eebf4a12`](https://github.com/Wickey23/boeing-vt-am-first-time-quality/commit/d6d6eebf4a12084cc5aab181006e20ca30cae604) adds a PDF `%%EOF` trailer assertion to `tests/browser/document-optional-assessment.spec.ts`. Existing test already checks an actual download, filename, `%PDF-` header and size >1,000 bytes. Trailer validation detects incomplete/truncated output that can otherwise pass header/size checks; it does not validate the semantic contents of the report.
- **CI before change:** [Engineering run 43946590297](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43946590297) completed **success** on `a8ebb089804d16e330e5b1a3374be053b553c458`: numerical regressions, TypeScript, Next.js build and browser regression all succeeded. The new test is **not considered passed** until its own run finishes.
- **Production deployment:** Vercel production alias `boeing-vt-am-first-time-quality-wickey23s-projects.vercel.app` returned deployment `dpl_3YMwAJuXRB43QxkVuvkH2Mpg3UWH`, `READY`, `target=production`, Git SHA `a8ebb089804d16e330e5b1a3374be053b553c458`. This confirms the previously tested SHA is deployed, **not** that the new PDF EOF assertion is deployed or that live routes/PDF export were smoke-tested.
- **Next release gate:** Verify the new CI run, then run a live public-STL upload → context → assessment → report download against a production deployment with a recorded SHA and preserve the downloaded PDF's hash. Separately inspect original NIST IN718 workbook/README units, specimen identities and independent validation splits before training; do not infer defect labels from melt-pool dimensions.
