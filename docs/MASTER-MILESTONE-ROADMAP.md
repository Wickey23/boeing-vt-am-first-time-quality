# ORIENTAI — Master development roadmap

**Owner:** Virginia Tech ISE Senior Design / Boeing-oriented research prototype  
**Plan established:** 2026-10-29  
**Baseline main SHA:** `71cdd40aece4ad585dc827c297d9c44f1276c354`  
**Status:** Planning specification; NOT a claim that unfinished work is implemented or physically validated.  
**Collaboration:** Refresh `main`, open PRs, CI and touched paths before every code change. Honor the project owner's prior direction to work on `main` without making new branches, using small isolated edits and no force-push. Preserve teammates' work and do not merge stale PRs wholesale.

## Mission and end-user contract

An engineer uploads a metal AM component (STL first; CAD when supported), optionally provides drawings/assembly documents, and converses with ORIENTAI to specify the part's purpose, loads, material, LPBF machine/process, postprocessing and requirements. The AI asks only for missing decision-critical information and proposes applicable analyses. After the engineer approves, source-identified tools calculate available results. The part remains visible through the chat and work stages; the user can inspect calculated fields, risks and unknowns, compare alternatives, and export a review package. The system must never claim build approval, defect probability or first-time success without compatible independent evidence.

**Primary process:** LPBF (PBF-LB/M). DED and production-flow/Simio are separately scoped capability tracks. An algorithmic energy-balance check is not experimental calibration; a successful build is not a qualified metal print.

## Releases and status semantics

- **R1 — Verified engineering research workbench:** complete upload → context → approved simulation → viewer → alternatives → reproducible report, with limits clearly labeled. No general failure prediction.
- **R2 — Bounded experimentally validated pilot:** demonstrate independently measured predictive performance for a *specific* alloy, machine, process envelope and part family, with uncertainty and abstentions.
- **R3 — Production platform:** authorized secure infrastructure, durable jobs, collaboration, auditability, managed releases and permitted machine interfaces. R3 software readiness does NOT qualify aerospace hardware.

Evidence labels: `not assessed` (unsupported), `screened` (deterministic heuristic), `calculated — unvalidated` (numerically evaluated without compatible independent experimental support), `validated within named scope` (matched held-out measurements with disclosed uncertainty). No global "safe to print" badge. Unknown critical values are blockers for decisions that depend on them.

## Baseline: implementation actually seen on main

Present in research form: chat-oriented UI and 3D STL viewer, STL mesh/dimension checks, orientation screening, simplified service structural and steady-thermal models, experimental coarse and moving-LPBF heat solvers, physical-layer scan CSV audit, separate through-height 1D enthalpy study, temperature probe and measured trace comparison, sensitivity tools, engineer approvals, local export/handoff. An independent partial-layer XY/height finite-volume research library exists at `lib/lpbf-partial-layer.ts` with initial numerical tests. **That library is NOT connected to real STL slicing or the UI, and its "consolidated" indicator is heuristic rather than verified melting.** Latest audited engineering CI for commit `e2c770bbeca826c6882112ce10d1f50012d6ac47` completed successfully; deployment and experimental predictive validity are separate.

Open PR #8 concerns deterministic production queues; open PR #9 DED/Simio planning. Both are separate from the imminent LPBF solver integration. Source of earlier completion and physics detail: `docs/COMPLETION-PLAN.md`, `docs/LPBF-TRANSIENT-RESEARCH-VALIDATION.md`, `docs/LPBF-PARTIAL-LAYER-RESEARCH.md` and `docs/SYSTEM_ARCHITECTURE.md`.

## Six phases, 21 milestone contracts

### Phase A — Project, product and geometry foundations (M00–M03)

#### M00 — Team-safe baseline, evidence ledger and CI [continuous]
- **Build:** fresh repository/branch/PR/deployment audit for every change; capability registry, model assumptions, data-protection boundary, test/run-status ledger.
- **Output:** exact change SHA, touched paths, model/evidence version, gates run, open conflicts, live deployment SHA if verified and remaining uncertainty.
- **Done when:** release reports are traceable, changes don't discard teammates' code, GitHub CI passes and any untested/deployment-blocked condition is reported accurately.
- **Depends on:** none. **Current:** processes already exist but must run every milestone.

#### M01 — Canonical engineering case and immutable analysis identity
- **Build:** versioned Project, GeometryRevision, Document, Requirement/CTQ, ManufacturingSetup, MaterialEvidence, ScanPlan, LoadCase, AnalysisRun, ValidationRecord, Decision and Artifact; immutable source hashes, units, frames and parameter provenance.
- **Output:** one project identity across chat, orientation, thermal, service studies, reporting and export; stable saved progress and schema migration.
- **Done when:** all dependent results invalidate correctly after material/units/geometry changes; old worker messages never overwrite current case; offline save/restore and export/import preserve the input/evidence chain; unknown values never silently default to qualified facts.
- **Depends on:** M00. **Current:** partially present.

#### M02 — HCI-driven, ChatGPT-familiar, part-centered user experience
- **Build:** one obvious action at a time; actual STL embedded in chat, persistent expandable viewer, guided questions, detailed result cards, accessible playback, evidence/uncertainty labeling, simple/advanced modes and recovery controls. Borrow interface *interaction patterns*, not branding, trademark, or proprietary assets.
- **Output:** documented conceptual model, task analysis, state graph, failure paths, copy vocabulary, mobile/keyboard/screen reader flows, usability test results.
- **Done when:** representative first-time engineers complete upload → confirm dimensions → explain requirements → approve study → interpret visualization → export without instructions; common error paths are recoverable, and accessibility evaluation meets the project target in `docs/hci/ORIENTAI-HCI-PROTOCOL.md`.
- **Depends on:** M01; coordinated with M04–M07. **Current:** chat UI exists, but integrated flow and tested comprehension are incomplete.

#### M03 — Verified geometry/CAD, transforms and engineer-defined regions
- **Build:** closed/manifold topology, shell and thin-feature assessment, accurate mm conversion, part/build/machine coordinate transforms, surface/attachment/critical region selections; introduce STEP/BREP only through approved licensed-compatible conversion worker.
- **Output:** geometry revision/coverage report and stable region references or explicit invalidation on remeshing.
- **Done when:** reference cube, bracket, hollow sleeve, thin wall and rotated/shifted geometry pass preregistered unit, volume, manifold and transform checks; unsupported geometry blocks physical analyses with an actionable reason.
- **Depends on:** M01. **Current:** STL partly supported, not robust feature/CAD region mapping.

### Phase B — Actual-part layer simulation vertical slice (M04–M07)

#### M04 — Physical-layer slicing of the *uploaded STL* [IMMEDIATE NEXT]
- **Build:** independent bounded STL physical slicer translating original bytes + engineer-confirmed units + build rotation + layer thickness + XY pitch + build origin into per-layer intersected cross-sections, material cell coverage and explicit error/volume bounds.
- **Output:** `lib/lpbf-physical-slicer.ts` (suggested), slice metadata with SHA-256, layer registration and geometric coverage; original STL unchanged.
- **Done when:** cube, hollow sleeve, thin-wall and angled-bracket fixtures pass layer count, Z origin, cross-section, volume and resolution tests; missing slices/undetected holes/thin-feature loss cause fail-closed warnings; no coarse six-slab projection is misrepresented as physical slices.
- **Depends on:** M03. **Current:** not implemented.

#### M05 — Sourced manufacturing configuration and real physical scan mapping
- **Build:** bind audited physical `layer,z_mm,t0_s,t1_s,x0_mm,y0_mm,x1_mm,y1_mm,power_w` commands to geometry slices with verified source bytes/checksum and machine-to-model transforms; clearly distinguish user CSV from a machine-verified native program. Process/material cards with explicit sources, conditions, and confidence.
- **Output:** scan-to-geometry audit report with exclusions, absorbed/commanded-energy comparison and missing parameters.
- **Done when:** gaps, discontinuities, wrong layer indices, shifted origins, laser-on empty space, and incompatible properties block the run; transition dwell and chronology are unambiguous; no fabricated machine settings.
- **Depends on:** M01, M04. **Current:** chronology parser/audit exists but physical mapping absent.

#### M06 — Engineer-approved partial-layer solver worker and truthful animation
- **Build:** independent bounded worker for partial-layer powder/consolidated numerical study on registered physical slices; real progress, beam position and material-state/thermal field frames; cancel/retry and source-hashed outputs. Keep earlier coarse/1D models separate.
- **Output:** chat-linked simulation card and expandible 3D/time viewer; frame and energy audit downloads.
- **Done when:** approval is mandatory; synthetic golden STL+scan scenario runs end-to-end; canceled/stale/mismatched identity responses never display; every visual metric maps to computed data; heuristic consolidation explicitly not "measured melting."
- **Depends on:** M04, M05. **Current:** library exists, not integrated.

#### M07 — Numerical V&V, convergence and independent reference checks
- **Build:** reference two-cell/1D conduction, powder/solid interface flux, signed boundary heat exchange, laser-motion time stepping, step/space sensitivity, mesh energy/geometry conservation, deterministic fixtures and reproducible reports.
- **Output:** numerical verification dossier with thresholds agreed before testing.
- **Done when:** predeclared analytic/independent comparisons pass or limitations are prominently disclosed; nonfinite/unstable runs fail closed; numerical sensitivity is quantified; no claim of experimental physics accuracy.
- **Depends on:** M06. **Current:** initial conservation tests, not complete convergence/validation.

### Phase C — Physics fidelity and external validation (M08–M11)

#### M08 — Higher-fidelity LPBF thermal/powder/phase physics
- **Build:** staged documented temperature-dependent material data, true phase-change enthalpy and melt fraction, appropriate powder/substrate/support exchange, beam absorption, optional radiation and bounded multi-resolution resolution. Keep fluid flow/keyhole/evaporation out of scope until supported.
- **Output:** separately versioned models with reference problems and input compatibility.
- **Done when:** model mechanisms have independent V&V and spatial/time refinement; unresolved melt-pool physics cannot be hidden by the current beam-core "consolidated" label.
- **Depends on:** M07; validation requires M09.

#### M09 — Experimental thermal benchmark pipeline
- **Build:** choose exact compatible NIST AM Bench or approved laboratory case; register part/scan coordinates and time origin, measurement provenance and uncertainty; distinguish calibration from blind validation; compute only physically resolvable thermal observables.
- **Output:** source-hashed measured-vs-modeled trace dossier, RMSE/bias and where valid time-above-melt/cooling-rate metrics.
- **Done when:** predeclared holdout metrics/tolerances and uncertainty are reported, along with failed comparisons; no solver is considered physically validated merely because input files were loaded.
- **Depends on:** M08. **Current:** exploratory measurement panel, not full physical validation.

#### M10 — Structural service-load analysis upgrade
- **Build:** engineer-picked original-part surfaces, multiple force/pressure and fixture cases, conforming tetrahedra via approved Gmsh/CalculiX or equivalent worker, stress/strain/displacement/reactions and source-qualified material values.
- **Output:** load-case provenance, convergence and equilibrium reports with real geometry fields.
- **Done when:** axial, bending and torsion references, reaction-force/moment balance, rotation invariance and multiple mesh levels meet predeclared tolerances; singular fixture stress and unmodeled contact are flagged.
- **Depends on:** M01, M03. **Current:** simplified voxel service FEA.

#### M11 — Print-induced distortion, residual stress and removal/postprocessing
- **Build:** staged inherent-strain or thermomechanical model with calibrated material/process, support/plate restraints, layer sequence and heat treatment/plate-release assumptions.
- **Output:** versioned displacement/stress maps with calibration and blind evaluation paths.
- **Done when:** independent relevant distortion/strain/deflection benchmarks support bounded predictions; no confusion with service-load stress.
- **Depends on:** M08, M09, M10. **Current:** not implemented as validated printer physics.

### Phase D — Risk decisions and optimization (M12–M14)

#### M12 — Geometric manufacturability and localized risk evidence
- **Build:** overhangs, conceptual supports, build-envelope contact, min-feature/thin wall, trapped powder/access, critical faces and supported machine-specific recoater risk with precise part regions.
- **Output:** per-risk region, method, units, input, source, limitation and suggested engineering action.
- **Done when:** golden problem geometries and transform checks reproduce findings; screening never masquerades as a validated defect forecast.
- **Depends on:** M03, M05. **Current:** partial geometric screening.

#### M13 — Defect- and failure-mechanism-specific supported models
- **Build:** independently scoped lack-of-fusion, keyhole, cracking, delamination, distortion, recoater, dimensional and in-service fatigue modules, only with compatible validated models and measurement labels.
- **Output:** coverage matrix with `not assessed / screened / calculated / validated within scope` states, localized evidence and uncertainty; abstention on missing facts.
- **Done when:** each enabled predictor has held-out labeled performance, domain limits, and predeclared quality targets. No single energy-density value or generative answer produces "print success %."
- **Depends on:** M09, M11, M12. **Current:** these mechanisms explicitly not assessed.

#### M14 — Constraint-first orientation, design and process alternatives
- **Build:** hard constraints first, Pareto candidate comparison, supported numerical re-use across geometry revisions, assumptions/cost/time tradeoffs and engineer-readable causal explanation.
- **Output:** baseline vs proposed alternatives, unresolved evidence and repeatable decision record.
- **Done when:** unsupported risks cannot silently affect ranking; reproducible candidates and isotope/part-frame invariance checks; a candidate with violated critical hard requirements is not marked feasible.
- **Depends on:** M12 and appropriate parts of M10. M13 enhanced predictive inputs are optional only after validated. **Current:** geometric comparison partial.

### Phase E — AI, measurement and parallel tracks (M15–M18)

#### M15 — Evidence-grounded AI engineering orchestrator
- **Build:** extract/cite engineer-reviewed reference documents, targeted missing-data questions, applicable-tool proposal, approval/permission checks, bounded execution, status/recovery and explanation grounded in immutable outputs. AI never computes fictitious FEA/thermal values by text.
- **Output:** visible tool-call/evidence history, model-vs-source distinction, missing input guidance and clickable relevant part locations.
- **Done when:** adversarial prompts cannot override approval or evidence level; no silent transmission of geometry; chat → tool → visualization → report works in one project.
- **Depends on:** M01, M02, stable M06/M10/M12. **Current:** local guide and opt-in API exist; complete orchestration incomplete.

#### M16 — Reproducible, applicability-aware ML
- **Build:** review datasets/units/license, reproduce baseline, group holdout by build/study, model registry and locked data splits, OOD detection and uncertainty. Separate simulated labels, real melt pool labels, actual inspection outcomes.
- **Output:** trained/evaluated model card and opt-in inference only within validated domain.
- **Done when:** preregistered held-out metrics beat meaningful baseline and coverage/abstention are demonstrable; first-time acceptance predictor only if actual build/inspection/rework labels exist.
- **Depends on:** M09, M13, M17 data. **Current:** ML experimental research.

#### M17 — Inspections, actual builds, measured FTQ and feedback
- **Build:** link exact part/scan/process/powder/machine/postprocessing to build records, in-situ data when authorized, CT/NDE/dimensions/defect location and independent acceptance/rework/scrap labels.
- **Output:** predicted-vs-observed dashboard with sample sizes, unknowns, cohort bias and uncertainty, dataset versioning and protected train/holdout splits.
- **Done when:** replay and audit show correct build linkage; no data leakage; observed quality outcomes are distinguished from software predictions.
- **Depends on:** M01 and approved data infrastructure M19. **Current:** not complete.

#### M18 — DED and manufacturing-flow/Simio interoperability (optional branch of product, no new Git branch implied)
- **Build:** process-specific DED subtype, substrate/deposition path/feed and physics; separate deterministic queue/discrete-event production flow with resource/cost assumptions and optional actual Simio interchange.
- **Output:** reviewed integration of existing PR #8/#9 only after reconciliation; explicit teaching-example labels and part-linkage requirements.
- **Done when:** LPBF assumptions cannot leak into DED; simulation trace is auditable; a deterministic approximation is never presented as an actual Simio run.
- **Depends on:** M01/M03 plus process data. **Current:** DED teaching slice + unmerged PRs.

### Phase F — Operational platform and releases (M19–M20)

#### M19 — Secure, durable simulation operations
- **Build:** worker/queue orchestration for long solvers, cancellation/retry/idempotency, durable artifact/version/permission/retention controls, secure approved storage and authorized external compute; deployment smoke checks, recovery/rollback.
- **Output:** trusted role-based operational engineering workspace and support/runbook.
- **Done when:** concurrent jobs isolated, stale jobs rejected, permission/recovery tests pass, production SHA matches intended tested SHA and controlled/export-restricted data are excluded until explicitly approved infrastructure exists.
- **Depends on:** M01; required more fully for R3. **Current:** browser workers/Vercel limited.

#### M20 — Release acceptance and bounded physical pilot
- **Build:** complete end-to-end functional, numerical, usability, accessibility and security acceptance matrix; verified deployment; independently reviewed report package; measured pilot plan, predeclared tolerances and blinded evaluation.
- **Output:** R1 research demo signoff; separate R2 measured performance report; R3 security/operation go/no-go checklist.
- **Done when R1:** another engineer can reproduce current supported run results from the exported project, and sees missing/not-assessed risks and research limits.
- **Done when R2:** independent measurements support only stated scoped predictions and uncertainty, with transparent negative results.
- **Done when R3:** organizational data/compute/security/release controls accepted, without implying flight qualification.
- **Depends on:** corresponding milestone groups. **Current:** partial automated regression, no independent validated FTQ claim.

## HCI and human-factors workstream — mandatory across ALL milestones

Detailed protocol and living audits: `docs/hci/ORIENTAI-HCI-PROTOCOL.md` and `docs/hci/INITIAL-REVIEW-2026-10-29.md`.

Inspired by the public Markdown-oriented [HCI Review Skill Pack](https://github.com/45ck/hci-review-skill), but authored here as ORIENTAI-specific documentation; no third-party install scripts are executed. Evaluation foundations: [Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) and [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). Target **WCAG 2.2 AA** for authored web flows, verified using both automated and human methods; never claim conformance from one automated scan.

Human factors gates for *each* feature:
1. Define user goal, persona/role and a representative task.
2. Write interaction and failure-state diagrams before implementing new workflows; specify `idle → incomplete → ready → approved → queued → running → completed/failed/cancelled/stale` where applicable.
3. Review vocabulary and scientific mental model. Label nominal physical layers vs coarse voxel slabs vs 1-D models accurately.
4. Minimize recall and redundant entry; surface missing inputs and why each is required, with contextual help and safe defaults that do NOT fake engineering approval.
5. Make feedback, cancellation and recovery accessible; do not hide long-running task state or irreversible decisions.
6. Check actual keyboard navigation, focus visibility, screen reader announcement of errors/progress, contrast, color-independent legends and motion controls. 3D fields require a textual/table equivalent.
7. Record heuristic/cognitive-walkthrough findings and their severity, linked evidence, remediation, owner and retest.
8. Conduct representative engineering usability sessions; predefine task success, time, critical errors and interpretation accuracy; preserve observed results separately from hypothetical expectations.

Release HCI blockers: uncorrected critical misunderstanding ("screened" interpreted as certified), silent stale results, unapproved simulation action, loss of input, inaccessible essential control, materially mismatched viewer legend, or inability to recover after a failed job. Screenshots/review notes alone are not usability study evidence.

## Dependencies and execution waves

- **Wave 0, immediately:** M00 audit + HCI conceptual model/initial review, M01 minimum input contract, M03 geometry basis.
- **Wave 1, next vertical slice:** **M04 → M05 → M06 → M07**, with M02 interface integration and HCI gates in parallel. Complete one real uploaded public fixture.
- **Wave 2, complete R1 research product:** M01–M03 polished, M10 limited verified service analysis, M12 geometric risk, M14 constraint-first decision, M15 approved orchestration, M20 R1 gate.
- **Wave 3, credible print physics and R2:** M08 → M09, plus M11/M13 as compatible evidence permits, M16/M17 and pilot M20. Expect data and computation dependencies.
- **Wave 4, R3/platform:** M19 production operations; authorized machine integration and M20 operational release. M18 optional parallel DED/production-flow track.

A milestone is DONE only with implementation SHA, test evidence, documented assumptions, usable review flow, independently checked deployment if claimed live, and explicit scientific/evidence limitations.

## Work-log template to use for every milestone

```markdown
### [Mxx] Title — status: TODO | IN PROGRESS | BLOCKED | VERIFIED
- Base main SHA / teammate PR review:
- Goal and engineering scope:
- User task / HCI review:
- Dependencies:
- Code files changed:
- Synthetic and real fixtures:
- Numerical/reference checks:
- Accessibility/interaction checks:
- Unit / typecheck / build / browser results:
- Scientific/validation state:
- CI and deployed SHA:
- Next action / blocker:
```

## Sources and companion specifications

- `AGENTS.md` — team safety and merge/release audit
- `docs/COMPLETION-PLAN.md` — detailed requirements and R1/R2 gates
- `docs/LPBF-PARTIAL-LAYER-RESEARCH.md` — standalone current research solver limits
- `docs/LPBF-TRANSIENT-RESEARCH-VALIDATION.md` — current transient research model
- `docs/SYSTEM_ARCHITECTURE.md` — enterprise-oriented system boundaries
- `docs/hci/ORIENTAI-HCI-PROTOCOL.md` — HCI review steps, tests and release gates
- NIST AM Bench: https://www.nist.gov/ambench
- NASA AM standards support: https://www.nasa.gov/centers-and-facilities/nesc/nasa-additive-manufacturing-standards-support-human-spaceflight/
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Nielsen Norman Group heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
