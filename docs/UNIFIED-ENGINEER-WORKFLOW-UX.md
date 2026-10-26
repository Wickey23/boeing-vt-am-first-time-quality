# ORIENTAI unified engineer-first workflow — product redesign and implementation specification

**Status:** UI / workflow design proposal (not implemented by this document).  
**Baseline:** application after main merge PR #10, commit 26a82392f6b20fe4dc58872b0bd2f8688bf42c2e.  
**Goal:** eliminate multi-app navigation and carry one part, requirements, process, scenarios and evidence from intake to review. Preserve existing numerical integrity and tests.

## 1. Problem diagnosis (from live repository code)

The current app has two independent starting paths:
- \`/orientation\` uses an STL project kept in \`AnalysisProvider\` / IndexedDB, with in-page stages \`verify | setup | results\`, and nested result tabs \`summary | compare | concerns | studies | save\`. A user can calculate geometric LPBF-like ranking and optionally solve simplified part-specific structural/thermal cases. The \`focused\` sidebar hides the Simulation Center and ML under a Research & Validation disclosure.
- \`/simulation\` uses \`DedPlanningStudio\`, a **separate** \`localStorage\` record \`orientai-ded-teaching-scenario-v1\`. It always models a synthetic single-bead DED wall, even when \`AnalysisProvider\` contains another user-uploaded STL. Its internal UI says so, but it feels like the next step of the same workbench even though the geometry, process inputs and reports are unrelated.
- \`/report\` consumes current STL/orientation analysis, not the standalone DED scenario; thus a user can perform a DED simulation but have no corresponding consolidated report.
- The homepage promotes ML training alongside primary workflow; \`/workspace\`, \`/am-process\`, \`/analysis\` and other older screens still exist with another \`EngineeringShell\` / \`ProjectProvider\`. Navigation is inconsistent across the application.
- \`ManufacturingSetup\` has assumptions and objectives from geometric LPBF proxy screening (plate contact, recoating, overhangs) but no process discriminator to avoid exposing inappropriate prompts for DED.
- A single orientation score is easier to interpret as manufacturing/quality success than as a **relative geometric research preference**.

This is a **workflow architecture** issue. More styling or more simulations do not solve it.

## 2. Product model: single current project

Canonical entity: \`EngineeringProject\` (versioned); users can save/open locally and export it.

Persistent project data:
1. \`geometry\`: STL File/reference, units and confirmed dimensions, SHA256, mesh health; teach example vs actual-upload provenance. For DED, an additional explicitly separate substrate/deposited-volume/path identity when necessary.
2. \`requirements\`: service load cases in part frame (preserve existing ServicePlan), geometry/CTQs, constraints, evidence/unknown status.
3. \`manufacturing\`: \`processKind\` discriminated union; machine/material/process profile and status of qualified vs illustrative values.
4. \`candidates\`: process-specific orientation + support/plate info for LPBF or orientation + substrate/deposition strategy for DED. Candidate has \`partHash\`, \`processProfileId\`, \`strategyHash\`, limitations and validity state.
5. \`analysisRuns\`: immutable results linked to a candidate and input snapshot; dynamic dependency invalidation. Existing original-part isotropic structural case results can be reused across build orientations only under verified rigid-rotation invariance.
6. \`decision\`: compared candidates, hard constraints, unknown critical criteria, chosen option and engineering rationale.
7. \`artifacts\`: reproducible JSON/PDF, simulation manifests and optional Simio table bundle, each linked to project + candidate.

The old DED wall data cannot be silently mapped to arbitrary STL projects. Mark it \`sampleSource: "synthetic-ded-teaching-wall"\` and create/open it as an explicit **Example Project** rather than quietly replacing user part geometry. If the user opens DED with an unrelated STL, prompt to create a teaching example project or show unsupported path generation; never display synthetic wall metrics as results for their part.

### Process discrimination

\`processKind = PBF_LB_METAL | DED_LB_WIRE | DED_LB_POWDER | DED_ARC_WIRE | DED_EB_WIRE\`.

- LPBF shows plate orientation, overhang/support geometry, recoating/layer estimate, depowdering and support removal. Existing orientation research engine should be explicitly \`LPBF geometric screening\` until other processes supported.
- Wire/powder laser DED shows substrate, head/access *verification status*, deposition path, bead assumptions, travel/dwell timing, machining stock and appropriate downstream route. The existing DED synthetic path engine supports **only the teaching wall**. Make \`not available for this geometry\` explicit for arbitrary STL.
- Arc/EB DED display not yet supported; do not present laser power input as universally applicable.
- Process switch invalidates only process-dependent artifacts and candidates. Preserve original geometry and service requirements; ask user to confirm the new manufacturing configuration.

## 3. First-run flow (one meaningful action at a time)

**Landing /project:** primary \`Start new analysis\`; secondary \`Continue saved project\`, \`Try an example\`. Research and ML are not first-run CTAs.

**Guided project workspace** with seven stages, always showing a persistent compact file/project header and actual part viewer:

| Stage | Engineering question | User action | Next gate |
|---|---|---|---|
| 1 Part | What component is being printed? | Upload STL or explicitly select demo; confirm units, geometry and errors | Critical mesh issue blocks physical calculations |
| 2 Requirements | What must the part withstand or satisfy? | Select load/fixture regions (limited current end faces until improved), loads and essential requirements, mark unknowns | Unresolved essential requirement stays explicit; exploration allowed, suitability not passed |
| 3 Print process | How is it being manufactured? | Choose LPBF/laser DED subtype, machine/profile/material/source and process-specific setup | Unknown machine prevents machine-feasibility pass |
| 4 Candidate planning | Which manufacturing strategies are possible? | Generate orientation candidates or teaching-wall deposition strategy; view tradeoff shortlist and warnings | No arbitrary-part DED path result until generated from actual geometry |
| 5 Engineering studies | What has been calculated or verified? | Run applicable structural/thermal/flow analysis; show prerequisites, progress, units and evidence | Unsupported cards state why and next action |
| 6 Decision | Which candidates best meet requirements? | See constraint-first comparison, uncertainty, unverified criteria and engineer choice | No winner with failed critical constraint; unknowns not treated as pass |
| 7 Report | What do we know, and what needs physical checking? | Download synchronized PDF/JSON/export tables, inputs + limitations + next actions | Full frozen run traceability or explicit missing sections |

Navigation model:
- A persistent horizontal step indicator / compact vertical rail within **one** primary route (e.g. \`/projects/current?step=part|requirements|process|options|studies|decision|report\` or URL-safe nested routes backed by same provider).
- Visible \`Back\` and **one** prominent \`Continue: [next action]\` in every stage; use exact step labels in buttons.
- No in-stage \`summary / compare / concerns / studies / save\` tab maze. Use a small \`More details\` disclosure for diagnostics, not another navigation.
- Users can revisit any completed step, and can explore later steps with an explanation of which capabilities are blocked; edits mark only dependent results \`needs rerun\`.
- Last viewed step restored on reload with the project; no hidden reset on browser return.

## 4. Screen layout and content specification

Desktop:
\`\`\`
┌────────────────────────────────────────────────────────────────────────────┐
│ ORIENTAI  /  Project: Mounting Lug A       Saved locally  [Export] [Help] │
├────────────────────────────────────────────────────────────────────────────┤
│ Part ━ Requirements ━ Process ━ Options ━ Studies ━ Decision ━ Report     │
├───────────────────────────────────┬────────────────────────────────────────┤
│ ACTUAL PART VIEWER                │  STAGE TITLE + PLAIN QUESTION          │
│                                   │                                        │
│ geometry, orientation, region     │  1–3 main questions or controls       │
│ highlights, toolpath (if real),   │  assumptions/limits where needed      │
│ stress/thermal field when backed  │  clear current status + missing data  │
│ by active run                     │                                        │
│                                   │                                        │
│ [front] [side] [top] [reset]       │  [Back]       [Continue: next action]  │
├───────────────────────────────────┴────────────────────────────────────────┤
│ Current project facts: Part ✓  Process ✓  Loads ?  Thermal not evaluated  │
└────────────────────────────────────────────────────────────────────────────┘
\`\`\`
Smaller screens: stepper horizontally scrolls, viewer is collapsible/sticky-shorter, primary action stays near form end and never overlays warnings. Don't hide important statuses in tooltips.

Label recommendations:
- \`New part analysis\` rather than \`Start orientation analysis\`.
- \`Manufacturing setup\` rather than \`What would you like to improve?\` before process is selected.
- \`Evaluate options\` rather than \`Find the best orientation\`.
- \`Simulate the selected option\` with cards: \`Service-load response\`, \`Thermal conduction / deposition history\`, \`Manufacturing distortion\`, \`Production flow\`; each independently \`Ready / Needs information / Unsupported / Running / Completed / Outdated\`.
- \`Ranked for selected geometric priorities\` rather than \`Best strength\`.
- \`Prepare engineering review\` rather than \`Ready to print\`.

An engineer should be able to answer at any point:
1. What part is being analyzed?
2. Which metal-AM process?
3. What input or action is needed next?
4. What has been **calculated** and what is **assumed**?
5. Which decision can we defensibly make now?

## 5. New global navigation

Visible primary:
- \`Projects\` (home + new/open + examples)
- \`Current analysis\` (all seven stage steps)
- \`Reports\` (current project results; disable with reason until available)

Secondary \`Research tools\` (not a competing workflow):
- Solver benchmarks (existing \`/simulation/benchmarks\`)
- ML experiments (existing \`/ml\`)
- Validation methods / documentation
- About / how it works

One sidebar shell throughout. Remove duplicate \`EngineeringShell\`/v2 project navigation in the eventual UX; preserve old URL links as redirects to the appropriate stage with a migration notice rather than silently deleting routes. Do not equate a legacy standalone fuselage demonstration with current uploaded part data.

## 6. UX for uncertain or missing engineering support

Use a **capability status model**, not a single pass/risk score:
- AVAILABLE: inputs valid, capability supported but not yet run.
- NEEDS_INPUT: missing machine/material/fixture/etc. or engineer confirmation.
- RUNNING: with progress, cancel and exact candidate identity.
- COMPLETE_NUMERICAL: verified calculation within explicitly named model scope.
- EXPERIMENTAL: research estimates, not externally validated.
- NOT_SUPPORTED: capability genuinely absent; explain scope.
- STALE: result exists but source input changed.
- FAILED: controlled failure with retry or correction action.

The UI must clearly differentiate this from acceptance / qualification. For example:
- \`Geometry: complete — 3 potentially unsupported surfaces\`
- \`Service displacement: model result available, requires material review\`
- \`DED collision check: not evaluated — machine geometry missing\`
- \`DED thermal simulation: not supported for this process in this release\`
- \`Simio manufacturing route: example CSV generated; licensed Simio model not run\`

Always show a short \`Why?\` and \`Fix / continue\` next to a blocker. Do not expose unvalidated "quality probability".

## 7. Specific issues to implement against current code

**P0 – Label and navigation changes (no underlying numerical change):**
- \`app/page.tsx\`: give one main CTA; remove prominent ML CTA; add \`Continue project\` and clearly labeled example CTA.
- \`components/v2/AppShell.tsx\`: always show current workflow link, do not hide Simulation Center unexpectedly under focused mode; demote research pages into a disclosure, and prevent cross-shell navigation confusion.
- \`/simulation\`: clearly say \`Synthetic DED wall teaching demo\` when not associated with an active part; no "open this after orientation" illusion until fully integrated.
- Rename ambiguous simulation labels; preserve \`/simulation/benchmarks\` for academic verification only.

**P1 – One project state and migration (critical):**
- Create \`EngineeringProjectV2\` with \`schemaVersion:2\`. Define geometry, servicePlan, process profile, candidate, simulations and artifact lineage. Import existing \`AnalysisProvider\` snapshots, keeping all service cases, load frames and model limits.
- Migrate standalone DED \`localStorage\` into explicitly distinct teaching example (do not merge into an uploaded STL).
- Add typed dependency invalidation and transaction-safe storage/portable backups. Persist current stage and show storage recovery/error state.
- A shared viewer consumes \`activeProject.geometry\`, \`activeCandidate\`, \`activeSimulation\`. If model-specific DED geometry lacks STL, represent this explicitly as a \`synthetic-wall\` viewer geometry source, never a substituted uploaded part.

**P2 – Route consolidation and first-run journey:**
- Build one \`/projects/current\` guided route and reuse tested geometry viewer, service case controls, candidate engine, DED teaching geometry and report components. Keep original solver engines intact.
- Link every stage via explicit \`Next\` and \`Back\`; show prerequisites, validation errors and clear nonblocking unknowns.
- Avoid exposing LPBF overhang/recoat inputs in DED. Avoid showing DED bead/traverse inputs in LPBF.
- Preset teaching project selection should set specific process + actual teaching geometry + appropriate processing route; only show screens backed by those known sources.

**P3 – Results integration:**
- Current report reads only orientation project; enhance report model to include DED teaching scenario separately where it belongs, and route to correct report based on active project.
- Simio export uses active project + candidate hash (not independent localStorage input only).
- Do not promise combined DED arbitrary STL results until such engine exists; show \`not yet implemented\` with next valid actions.
- Comparison distinguishes physical structural, geometric manufacturing, time/cost estimate, factory-flow scenario assumptions and untested acceptance requirements.

**P4 – Decommission confusing legacy navigation:**
- Audit standalone routes under \`app/workspace\`, \`app/am-process\`, \`app/analysis\`, \`app/optimization\` etc. Redirect obsolete entrypoints when their data and functionality are superseded. Keep deep links for research examples under a clearly named Examples/Labs section.
- Remove duplicated global nav components only after browser/integration tests prove no regression.

## 8. Exact acceptance tests

### First-time LPBF route
1. Open homepage; one clear \`New part analysis\` action.
2. Select mounting lug teaching STL; confirm units/dimensions and topology.
3. Define load case with original-part fixture and force.
4. Select \`Laser powder-bed fusion\`, machine envelope and material identity.
5. Generate orientation candidates; compare height/down-facing/support proxies with exact evidence labels.
6. Run basic supported structural case (or see blocked reason), select another candidate; input state remains.
7. Export PDF/JSON with same part hash, process, candidate and unresolved safety/quality criteria.

### First-time DED route
1. Start example explicitly labeled \`DED teaching wall\` from landing page.
2. Select laser wire-fed, review substrate/bead/path and assumed speeds.
3. Compare \`alternating\` vs \`one-way\` strategy; explain differing reposition motion and commanded time.
4. Run reference factory-flow scenario, then export Simio tables.
5. Structural/thermal/distortion cards show only supported capabilities, never pretend DED quality has been predicted.
6. Export traceable DED report tied to **this example**; no uploaded STL is mixed in.

### Critical regression / confusion tests
- Switch process: incompatible fields hidden, process-dependent runs \`STALE\`, original-part loads preserved; report agrees.
- Upload real STL then visit DED path: app must not show synthetic wall results as user-part results.
- Reload / browser back / import project: no lost geometry, service cases, selected process, stage or identity.
- Attempt to proceed with missing machine: can explore research paths, but no \`manufacturing feasible\` outcome.
- Failed/cancelled worker: actionable recovery, stale result not presented as current.
- Home, current project, analysis, example, report all use the same shell and single source of truth.
- At 375 px width, ability to identify stage, part, next button and failure status without overlapping controls.
- 5–8 representative users new to the tool can finish LPBF example and DED example unaided. Record wrong turns and recovery points; set quantitative targets before pilot (e.g. 0 wrong-part calculations / 0 false-pass interpretations).

## 9. Release and sequencing

**Phase A:** navigation/content correction and DED teaching-mode honesty. This is the least risky user-visible improvement.

**Phase B:** canonical project state, migration/round-trip tests and versioned process discriminator. Engineering correctness gate before consolidating pages.

**Phase C:** stepper workspace, common viewer and LPBF/DED branching, preserving existing solver engines.

**Phase D:** unified result/report lineage, in-product Simio export, candidate compare and capability states.

**Phase E:** historical-route redirects and usability validation, production release only after CI/build/e2e, preview visual QA, regression of saved projects and rollback.

Do not ship a visually unified flow that merges incompatible physical part and DED demonstration states. If Phase B is incomplete, retain clear separation and accurate labels instead.

## Definition of success

A new user should complete one defensible orientation or DED teaching-study comparison from a single entrypoint without opening a second unrelated project or interpreting a simulated number as qualification. Every stage makes the next action and its prerequisite evident. Reports remain tied to the exact part/strategy and distinguish research assumptions from validated evidence.

**No new solver physics is authorized or implied by this user-experience redesign.** The next physics packages remain in the integrated DED/Simio roadmap and require separate verification.
