# ORIENTAI integrated completion plan: engineering simulation, DED and Simio

**Status:** proposed implementation roadmap only, no additional simulation functionality or physical validation delivered by this document.
**Baseline:** main SHA 30c268840875ee779832aae05d116a652fcc810c, reviewed 2026-10-26.
**Companion:** docs/COMPLETION-PLAN.md remains the existing requirements and validation baseline. This plan makes implementation order, contracts, DED and factory simulation explicit. Where constraints conflict, engineering evidence and explicit validation gates take precedence.

## 1. Mission and release boundaries

Deliver an engineer-guided AM decision workbench:

**Upload -> verify geometry -> describe service/mounting/quality requirements -> choose LPBF or DED -> generate candidate manufacturing strategies -> execute supported physics and production-flow simulations -> filter hard constraints -> compare tradeoffs -> export reproducible evidence -> measure actual results and improve models.**

This is a **decision-support research platform**, not a qualified manufacturing controller, a flight-worthiness assessor, or a promise of first-time acceptance. The application cannot automatically infer a realistic qualified material/process allowables set, nor infer process reliability from sparse melt-pool labels.

Two independent completion milestones:
- **Research workbench complete:** one supported part and route can be processed end-to-end with reliable inputs, verification-backed supported calculations, a demonstration DES route (Simio or equivalent), comparison, traceability, transparent unvalidated items and reports. No real manufacturing acceptance claim.
- **Validated pilot complete:** a specific material + feedstock + machine + process + postprocessing + part family has documented numerical and physical validation against predeclared criteria, with held-out builds. External reviews and final manufacturing qualification remain separate.

Never interpret passing software tests or finite-element numerical convergence as aerospace qualification. Sponsor/company controlled geometry and datasets must not enter public repo, browser telemetry, unapproved cloud worker or third-party AI. Use public teaching parts until data handling is approved.

## 2. Audited implementation starting point

Code present as of baseline:
- Main guided STL workflow in app/orientation/page.tsx with model viewing, dimension/unit review, orientation search, geometric risk and project export.
- Persistent original-part named cases: lib/service-plan.ts; currently fixed opposite extreme end faces and total XYZ force, not actual holes, constraints, bolts or pressure regions.
- Local browser solver: lib/voxel-structural.ts (isotropic voxelized small-strain linear elasticity) and lib/voxel-thermal.ts (steady isotropic conduction), executed through browser workers and displayed in components/PartStructuralPanel.tsx and PartThermalPanel.tsx. They have restrictive resolution, approximations and no process-distortion validation.
- app/simulation/page.tsx is a **solver benchmark page**, not a workflow for running AM manufacturing simulations. app/api/simulation/route.ts is a geometric/layer-sensitivity comparison, **not** manufacturing DES or thermomechanical simulation.
- lib/analysis-workspace.ts and components/AnalysisProvider.tsx preserve project state and run identity locally. Some older routes (e.g. app/workspace and app/am-process) represent alternative flows; avoid fragmenting the product.
- lib/materials.ts already lists DED process/material compatibility but does not implement process-specific DED inputs/path physics.
- ml/ has research-only support and melt-pool experiments; current 227-record Ti-6Al-4V reproduction has unverified units/applicability, source/duplicate review and no release eligible prediction.
- Existing JSON/PDF engineering reporting and browser/engineering/ML tests, including GitHub Actions workflows.

Confirmed absences: general surface-region fixtures, production conforming meshes, verified machine/material condition cards, transient AM process thermal solver, validated residual stress/distortion, DED deposition path simulation, Simio flow exchange/experiment model, measured reliability models, audited physical pilot.

Do NOT relabel the current voxel or orientation endpoints as full manufacturing simulation.

## 3. System decomposition / design contracts

### Canonical application UI
Use app/orientation (or migrate to a clearly named /projects/:id workspace) as the **single canonical workflow**. Introduce a Simulation Center tab/screen from the persistent part workspace. Redirect or clearly label legacy demo screens; do not create a second independent part file or manufacturing settings source.

Suggested tabs: Part | Requirements | Print Setup | Orientations | Simulation | Decision | Report | Validation. Persistent part viewer and candidate selector span tabs. Every screen shows the next action, input validity, current run, evidence tier and unavailable reasons.

Simulation Center has cards:
1. **Service structural**: conforming FEM, stress/displacement/reactions, multiple requirements.
2. **Manufacturing thermal**: time-varying temperatures and cooling history, with explicit LPBF/DED scope.
3. **Manufacturing distortion**: after-build shape and displacement estimates; never silently equate thermal strain to final distortion.
4. **Manufacturing flow / Simio**: build/postprocess/inspect routes and resources, downtime/rework what-if scenarios, lead-time/yield distributions.

A card's supported states are: NOT_CONFIGURED, READY, QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED, STALE, UNSUPPORTED; each result also reports evidence tier: illustrative, numerically verified, calibrated, externally validated, physically validated in scope. This prevents UI status from implying qualification.

### Versioned records and run lineage
Adopt explicit interfaces/modules:
- Project, GeometryRevision (file hash, original units/frames), FeatureRegion (surface triangles/CAD face IDs, mesh correspondence), Requirement, ServiceLoadCase (part-frame loads), MaterialCard (source/process/condition), ProcessProfile, MachineProfile, OrientationCandidate, DepositionStrategy, BuildRoute, SimulationScenario, SimulationRun, ResultArtifact, InspectionResult, ModelRegistryEntry, ValidationRecord.
- Separate **design/service inputs** from **manufacturing inputs**. Rotating a build direction must not rotate service forces relative to the part. A CAD part coordinate frame and build/substrate/machine frames must be explicitly transformed.
- Immutable SimulationRun snapshot: runId, parent project/revision, geometry SHA256, manufacturing configuration hash, load-case hash, solver engine/version/container, material-data version and source, mesh/path generation parameters, random seed, environment, timestamps, units, status/error logs, field artifact identifiers, validation status and limitations.
- Dependency-based invalidation: fixture edit invalidates affected structural case; heat treatment/material change invalidates property-dependent solvers; orientation change invalidates print geometry/support/thermal/DES inputs, not original-part service requirements; late worker responses cannot overwrite a newer run.
- Retain privacy by default: browser-local work first; remote jobs only through an explicitly approved backend/service with authentication, authorization, scoped storage, deletion/retention and audit. No unapproved automatic uploads.

### Simulation execution architecture
Keep Next.js/Vercel for UI, API orchestration and bounded inexpensive calculations. Long meshing/transient FEM/DES experiment workloads require a queued worker **outside** normal short-lived UI/API execution, or a locally approved desktop runner. Define:
- POST /api/simulation-jobs: validated serialized request and idempotency key, returns jobId.
- GET /api/simulation-jobs/:id: status/progress and structured errors, no claim of success without artifacts.
- POST /api/simulation-jobs/:id/cancel: best-effort cancellation with terminal state verified.
- GET /api/simulation-jobs/:id/artifacts: permission-checked manifests/downloads.
- Each engine implements an adapter with capabilities, validateInput, estimateCost, run, validateOutput, metrics, provenance.
- Worker limits: per-file size, geometry complexity, wall time, memory, parallel jobs, retries; timeouts/cancel handle cleanup and suppress stale responses.
- All unavailable high-fidelity solver features must be visible as unsupported or awaiting an approved solver, not fabricated results.

## 4. Manufacturing profile split: LPBF vs DED

**LPBF-specific inputs:** build chamber/envelope, layer thickness, recoating, powder properties, scan strategy, support geometry/anchors, plate temperature, contour/hatch data and postprocess rules. Existing height/support proxies remain explicitly geometric estimates.

**DED-specific inputs:** modality (e.g. laser powder-fed vs laser wire/hot-wire; do not conflate), head/nozzle and reach envelope, substrate/baseplate, feedstock alloy/form, energy/power, travel speed, powder/wire feed, nominal bead width/height and overlap, direction of deposition/toolpath and machine axes, interpass temperature/dwell, shielding, clamping, support/access, machining stock, inspection and postprocessing. Inputs remain unknown until supplied. Define parameter bounds from the actual machine/material/process record rather than universal defaults.

DED scope progression:
1. Validate deposition feasibility: bead-layer concept, candidate orientation, kinematic access/reach/collision envelope, substrate/machine fit, deposition and machining access, weld/path interruptions and unsupported features. If kinematics are unknown, mark unverified.
2. Create editable path strategies for teaching examples: contour/infill or raster tracks, alternating direction, deposition order, travel segments, bead footprint and interpass dwell. Visualize nozzle/path and predicted elapsed deposition time, with separate start/end conditions and removed/machined volume.
3. Integrate thermal activation and heat input **only after** process heat/transfer assumptions are documented. Build reproducible bead- or layer-activation chronology; retain boundary conditions, convection, plate, material k(T), c(T), density and latent heat only where supported by model and data.
4. Calibrate track/bead size, temperature and part-scale distortion using compatible specimens. Until then, display geometry/path timing or verified conduction results, not defect, residual stress or pass/fail certainty.
5. Support DED repair/feature addition only as a separate future case with part substrate, preexisting geometry, material compatibility and safety review.

DED and LPBF are different manufacturing routes. No borrowed LPBF support, build-time, anisotropy, porosity or thermal-distortion formula may be promoted as a validated DED result.

## 5. Structural simulation roadmap

1. Geometry: preserve STL intake and evaluate STEP/BREP import through an approved geometry worker. Reject open/nonmanifold or unusable meshes; preserve feature identity and units.
2. Regions: select actual triangle patches/analytic CAD faces, bores, attachment patches and loaded surfaces. Store stable original-part regions, area, normals and geometry identity. If region remapping is ambiguous, request reselection. Support clamped/prescribed displacement and force/traction/pressure; do not claim realistic bolt/contact loads until explicitly modeled.
3. Solver: pilot reviewed Gmsh + CalculiX (or equivalently capable, license-reviewed stack) in a dedicated worker; validate mesh and tetrahedra; integrate elastic stress/displacement, reaction force/moment and convergence studies. Reference input decks and solver versions.
4. Requirements: yield/displacement margins only where material properties and safety factor conventions are traceable; mark absent strength/fatigue data NOT_EVALUATED. Contact, temperature dependence, nonlinear/plasticity, buckling and fatigue are separate validated gates.
5. Verification: axial/torsion/bending analytic comparisons, equilibrium force+moment, rigid-coordinate invariance, mesh refinement, independent solver comparison and singular fixture stress handling. Define quantitative tolerances before viewing benchmark outcomes.

Gate: service loads remain physically attached under build rotation and an isotropic original-part service case does **not** change nominal strength solely because the printing orientation changed. Directional rankings require actual directional material/defect/surface or residual stress evidence.

## 6. Thermal and distortion roadmap

Progress incrementally and never blend different evidence tiers:
- T0 existing steady conduction: preserve and label educational / limited physics.
- T1 transient heat equation with known conduction boundary conditions, spatial and temporal refinement, energy conservation, k(T)/c(T) when supported; verify analytical decay, heat-flux and conservation benchmarks.
- T2 DED moving energy-source, bead/layer activation, path chronology, substrate, convection/contact/fixture and validated temperature observation locations. Verify discretization, moving-source behavior and temperature time series; mark melt pool/process phenomena omitted by reduced models.
- T3 LPBF-specific layer/scanning approximation only if machine strategy and compute budget permit; don't imply melt-pool CFD.
- T4 calibrated inherent-strain or sequential thermoelastic distortion model for **one bounded** machine/material/process family. Model build plate, clamping, separation/cut/release, heat treatment or stress relief only if represented. Predict displacement fields relative to defined datum. Residual stresses need a verified constitutive approach and compatible validation, not an estimate inferred from service stress.
- T5 compare blind predictions against held-out NIST AM Bench or lab measurements for temperature history, residual strain and dimensional distortion within matching conditions. Separate calibration and independent validation datasets, publish errors in degrees, mm and MPa as applicable, confidence/applicability and failures.

Gate: report mesh/time sensitivity, thermal energy balance, measured-vs-predicted locations, known limitations and baseline models. Refuse unsupported extrapolation.

## 7. Simio / manufacturing discrete-event simulation

The word **Simio** refers to discrete-event factory/production simulation. It does not solve temperature, FEA or metal deposition thermophysics. Use it to compare how engineering candidate routes affect **production**.

**Integration strategy, phase 1 (works without proprietary runtime):**
- Introduce versioned, documented ORIENTAI ManufacturingScenario schema; export six normalized CSV tables plus a manifest and read back a documented results CSV/JSON schema.
- Prefer CSV/table binding for Simio instead of inventing a direct cloud API. Simio documentation supports data-table import/binding and export. Actual Simio execution requires the team's own supported installation/licensing.
- Independently implement a small deterministic or seeded discrete-event reference engine if Simio runtime/license is unavailable, with explicit tag RESEARCH_DES_NOT_SIMIO; validate it on toy queues, then use it for the demonstration. Do not describe it as Simio.

**Proposed CSV contracts:**
- scenarios.csv: scenario_id, geometry_hash, candidate_id, process_profile_id, batch_size, replication_count, horizon_h, seed.
- resources.csv: resource_id, resource_type, capacity, schedule_id, downtime_policy_id, hour_cost.
- operations.csv: route_id, sequence, operation_id, resource_id, distribution_type, param_1, param_2, setup_h, transfer_h, dependency_id.
- jobs.csv: order_id, part_id, scenario_id, quantity, release_time_h, due_time_h, priority.
- quality_routes.csv: process_profile_id, operation_id, inspection_type, pass_probability_source, assumed_pass_probability, rework_route, scrap_route; no default defect probability.
- assumptions.csv: parameter, units, evidence_tier, source, applicability, last_verified.
- result_summary.csv (import): scenario_id, run_id, replication_count, mean_lead_time_h, mean_queue_h, mean_WIP, throughput_parts_per_h, resource_utilization, total_cost, observed_or_assumed_yield and estimated confidence intervals; keep fields missing when not exported.

**Conceptual model entities and stages:** order released -> prep/setup -> printing/deposition -> cooldown -> part removal or substrate detachment -> heat treatment/HIP if applicable -> support removal or machining -> inspection/NDE -> optional rework or scrap -> accepted output. Resource requirements include printer/DED cell, technician, downstream machining, heat treatment, inspection and shifts. Clarify parallel steps and batching. Placeholders must be marked as scenario assumptions, not real facility history.

**Simio model deliverables:** data-bound baseline model with Source/Server/Resource/Path/Sink analogs appropriate to licensed Simio version, resource and queue accounting, end-to-end route for LPBF and DED, batch/shift/downtime/stochastic process times, scenario controls, experimental replications, response table exports and a step-by-step team exercise. Do not promise to automate execution through Simio without verifying the installed product, license and supported connectors.

**DES verification:** conservation of orders, WIP = released - completed - scrapped - departed as applicable, no negative time/capacity, deterministic single-server hand calculations, seeded replay, queue stability in simple known cases, replication convergence, startup/warm-up policy when justified, confidence intervals and documented stochastic distributions. Separate factory simulation output from physical model predictions.

**No guessed first-pass yield:** where measured failure/rework data are absent, allow a visibly labeled 100%, 95%, 85% *illustrative scenario slider* for what-if comparisons, never a learned probability or production fact.

## 8. Multiobjective orientation and route decision engine

Comparison unit is **ManufacturingCandidate** = geometry revision + orientation + process profile + supports/deposition path + postprocess route + machine/material conditions, not just Euler angles.

Constraints first: envelope; machine/path reach; surface criticality; uninspectable regions; required mechanical margins with sufficient evidence; displacement; dimensional tolerance after supported distortion model; postprocessing access; machine/material qualified process envelope; missing essential requirements. Unknown is NOT_EVALUATED, not passed.

After excluding true failures, show nondominated candidates for support burden, build/deposition time, estimated manufacturing cost, distortion uncertainty, service margin, system lead time, throughput/first-pass yield scenarios and practical accessibility. User-selected weights only rank already eligible comparable candidates. Do not mix measured yield with hypothetical Simio input distributions.

Use a staged budget: fast geometry constraints -> shortlist -> structural cases -> process thermal/distortion where supported -> manufacturing-flow replicates -> results. Cache by immutable hash and invalidate dependents correctly. Retain a rejected option list and explain which constraints fail, what model was used and what could change the decision. No global-optimum claim from a finite candidate sweep.

## 9. ML roadmap and exact release gate

Preserve and clean existing melt-pool reproduction; complete source units, duplicate lineage and compatibility assessment. No inference merely because 227 experimental records exist or a random split score looks good.

Only train each target from matching labels:
- Slicer support-volume labels -> support estimate per slicer/machine/preset; group holdout by part/build.
- Distortion field or dimensional metrology -> distortion surrogate for calibrated process/material plus compatible solver/measurement target.
- Mechanical response -> directional tensile/fatigue data with source conditions; do not infer mechanical strength from melt-pool dimension alone.
- First-pass accepted vs rejected builds -> eventual acceptance classifier requiring historical outcomes, CTQ definitions, process controls, inspection completeness and independent held-out builds.
- DES processing-time, downtime, rework distributions -> fit from actual shop-floor records only; otherwise what-if assumption parameters remain explicit.

For each model: dataset/code/seed/splits/checksum, provenance/units, grouped and external evaluation, baseline comparison, MAE/RMSE or classification metrics with intervals, error by machine/study/material/part, applicability limits, drift handling and explicit model registry. Inference abstains if any required conditions/units are unknown, out of scope or missing. Results must never override a failed hard constraint.

## 10. Reports and validation data

Single frozen engineering review package:
- project/revision, source-file identity and units; service setup; region geometry and coordinate frames;
- process/machine/material/property sources and condition;
- ranked/rejected candidates and exact weights/constraints;
- simulation manifest, solver/model version, mesh/time refinement, units, field statistics, field-artifact locations, validation evidence and uncertainties;
- Simio scenario route/assumptions/replication statistics, clearly distinct from part physics;
- predicted vs measured inspection outcomes where available; unresolved decisions and next physical tests;
- machine-readable JSON, CSV Simio exchange, reproducible solver decks and PDF with matching displayed values.

Physical pilot data schema: coupon/part ID, actual orientation/location/build ID, machine/feedstock lot, timestamps, substrate/fixture/support, deposition/scan parameters, operator deviations, heat treatment/HIP/machining, dimensions vs CTQs, warpage, NDE results, mechanical tests and disposition (first pass, planned processing, rework, rebuild, reject). Pre-register acceptance criteria, material traceability and blind validation split.

Quality categories:
1. no data;
2. illustrative;
3. numerical verification only;
4. calibrated within a named process condition;
5. independently physically validated within that scope.
This is evidence lineage, not flight qualification.

## 11. Work packages, sequencing and handoff gates

| ID | Priority | Work package | Main dependency | Deliverable / exit gate |
|----|----------|--------------|-----------------|-------------------------|
| P0 | Critical | Freeze baseline/CI and agree scope, resources, Simio access, sponsor data handling, machine/material/part family | None | Approved inputs and gap list; no changes to production assumptions without review |
| P1 | Critical | Versioned scenario/run contracts, input invalidation and canonical guided Simulation Center | P0 | Reload/edits/retry/export preserve inputs; stale jobs rejected; honest statuses |
| P2 | Critical | DED process subtype configuration and process-specific geometric/path screening | P1 | Invalid DED scenarios blocked; verified units/inputs/path/reach warnings; LPBF unaltered |
| P3 | High | Simio CSV/manifest exporter, example routes, result importer and first DES reference benchmarks | P1 and P2 | Round-trip fixtures; labeled assumptions; conservation/replication tests |
| P4 | High | Arbitrary original-part load/fixture region selection and conforming structural worker | P1 | End-to-end part-specific FEA, equilibrium + analytic/reference + mesh-refinement checks |
| P5 | High | Transient thermal solver, boundary/energy verification and simple DED moving-path activation | P1, P2, material sources | Energy/time/mesh checks; temperature history visualized and benchmarked; limited/research label |
| P6 | High | Calibration-based manufacturing distortion within a narrow condition | P5 and physical/reference evidence | Blind dimension/warp comparison and published error; no result if calibration absent |
| P7 | High | Simio licensed-model execution (if available) and scenario comparison with real resource routes | P3 plus license/facility data | Replicated scenarios, confidence intervals and model/source reconciliation |
| P8 | High | Constraint-first multiobjective shortlist; combined structural, thermal and factory results; final report | P3/P4, P5 where supported | No failed/unknown requirement promoted to verified pass; reproducible PDF/JSON/CSV |
| P9 | Conditional | Target-specific ML and model registry/inference gating | Valid labeled data | Independent group-held-out errors and applicability pass predeclared thresholds or inference remains off |
| P10 | Critical for pilot | Physical build/inspection validation, user acceptance, QA and pilot release | Laboratory and sponsor approval | Evidence-based limited pilot claims, rollback, CI/browser/security checks |

Parallel lanes after P1: (P2 -> P3 -> P7) **process/factory** and (P4, P5 -> P6) **engineering simulation**, converging at P8. P9 only if labels are adequate; P10 is not a software-only activity.

Each PR contains implementation, typed schemas, fixtures, unit/integration/browser tests, limitations, migration and failure modes, and a reviewer-friendly demonstration. Merge only after CI and documented acceptance, then verify deployment. Do not conflate a Vercel build with solving engineering benchmarks.

### Recommended checkpoint demonstrations
- **Checkpoint A: workflow demonstrator** (P0/P1/P2): engineer uploads mounting lug, sees actual-part viewer, chooses LPBF vs DED and validates setup; unsupported fields visibly unavailable.
- **Checkpoint B: integrated simulation storyboard** (P3/P4): a candidate yields verified structural result plus machine/process route CSV, and Simio or reference DES returns queue/time what-if outcomes.
- **Checkpoint C: manufacturing physics** (P5/P6): a DED teaching specimen shows a time-resolved temperature result verified numerically, and measured distortion only if compatible calibration exists.
- **Checkpoint D: complete research workbench** (P8): end-to-end comparison and report with no fabricated readiness indicators.
- **Checkpoint E: validated engineering pilot** (P10): a held-out physical build is compared against frozen model predictions.

### Rough effort bands, not completion promises
For a small student team with approved tooling, UI/schema/DED screening/DES interchange can be broken into short weekly PRs. A credible independent conforming structural worker and transient DED model require additional multi-week numerical work and verification. Process distortion calibration and physical pilot additionally depend on lab access, test equipment, machine data and build lead times, which can dominate the schedule. Estimate dates only after P0 confirms those external dependencies. Choose a narrower validated demo over broad inaccurate claims.

## 12. Definition of done / release checklist

**Every release**
- Engineering statuses have no unsupported 'pass' or unlabeled assumptions.
- Real STL and teaching examples complete upload -> service requirements -> process -> compare -> simulation results/limitations -> export without lost inputs.
- Units, frames, transformations, material conditions, provenance and immutable hashes are always available.
- Invalid mesh, no fixtures, unstable solver, missing property, absent license, absent labels and missing DES data are controlled, understandable states.
- Numerical benchmarks and predeclared tolerances, integration fixtures, browser journeys, accessibility/typecheck/build, regression tests all pass.
- Job timeout/cancel/retry/rollback; privacy/permissions/retention are tested as appropriate.
- Outputs distinguish 'part physics', 'factory flow assumptions' and 'experimental evidence'.
- A fresh team member can reproduce one example and review all unresolved risks.

**Validated-pilot release, additionally**
- A named bounded process/material/machine/part family and owner-approved acceptance criteria.
- Independent numerical references and held-out temperature/distortion/mechanical/inspection observations, with error and sample counts.
- Inspection/factory performance from real recorded builds rather than hypothetical probabilities.
- Sponsor/lab assessment of limitations, process handling and intended use.
- Report makes no certification / airworthiness claim without the separate applicable approval process.

## 13. Immediate issue backlog (start in this order)

1. Decide canonical route and remove duplicated/conflicting simulation terminology. Rename current /simulation to *Solver Benchmarks* and /api/simulation geometric endpoint to a backward-compatible labeled name where feasible.
2. Add typed ProcessProfileV2 LPBF/DED discriminated union and migration from current simple material/process strings.
3. Add SimulationScenarioV1 / SimulationRunV1 and dependency invalidation tests; wire them into the persistent AnalysisProvider.
4. Build Simulation Center empty-state cards and actual part/candidate selectors.
5. Create teaching DED bead-path fixtures with known dimensions, no unverified default alloy settings; add path/envelope/gap test fixtures.
6. Export/import Simio-compatible data CSV bundle with schema, example routes and tests; ask team to verify installed Simio version and license.
7. Build local reference DES for the example workflow if Simio is unavailable; tests against a deterministic manual calculation, then replication statistics.
8. Scope region-selection geometry and meshing-worker proof-of-concept with one lug; do not attempt every nonlinear solver feature.
9. Scope transient thermal numerical benchmark and only then DED moving-source simulation; identify a NIST DED measurement set that actually matches chosen process.
10. Present a team demo and explicitly enumerate measured data and machine access needed for P6/P9/P10.

## 14. Evidence and research links
- Prior roadmap: docs/COMPLETION-PLAN.md
- NIST AM Bench: https://www.nist.gov/ambench
- NIST multi-physics PBF and DED validation effort: https://www.nist.gov/programs-projects/metrology-multi-physics-am-model-validation
- NIST DED overview: https://www.nist.gov/additive-manufacturing/research-areas/technologies/directed-energy-deposition
- Simio published CSV/table import/export workflow: https://textbook.simio.com/SASMAA7/ch-data.html
- Simio manufacturing scheduling/example route files: https://textbook.simio.com/SASMAA7/ch-scheduling.html
- Gmsh docs: https://gmsh.info/doc/texinfo/
- CalculiX official resources: https://www.calculix.de/
- NASA-STD-6030 applicability: https://standards.nasa.gov/ (refer to current controlled standard; this project does not claim compliance)
