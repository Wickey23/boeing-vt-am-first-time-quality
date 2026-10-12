# CAD-Agnostic Metal AM First-Time-Quality Platform — Implementation Specification
Date: 2026-10-12
Status: engineering roadmap; NOT a validated production/flight-approval capability.

## Product thesis
Allow an engineer to upload an arbitrary **approved** mechanical CAD part, specify design intent, loads, manufacturing and inspection constraints, then receive geometry-specific, traceable manufacturability screening and ranked build-preparation alternatives. Preserve the existing thin-wall fuselage surrogate as one validation benchmark, not a hardcoded requirement.

**Scope boundary:** generic upload and geometry screening are achievable first; automatic trustworthy structural redesign of arbitrary geometry is a separate, substantially harder problem requiring boundary conditions, a CAD kernel, meshing, solvers, and validation. No tool should infer loads or qualified machine parameters from shape.

## Research grounding
- NASA's AM process flow separates design/analysis, build preparation (orientation/supports/slicing/distortion), build operations, postprocessing, and inspection. https://ntrs.nasa.gov/api/citations/20190002104/downloads/20190002104.pdf
- NIST identifies orientation as multi-objective (support, cost/time, shape, distortion), and emphasizes validated simulation and measured data. https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=935436 ; https://www.nist.gov/programs-projects/metrology-am-model-validation
- FAA AM process-control guidance includes machine qualification, feedstock, part production and postprocessing controls. https://www.faa.gov/aircraft/air_cert/design_approvals/dah/additive_mfg
- FAA AC 33.15-3 applies specifically to powder-bed-fusion aircraft engine parts; it is not a blanket approval for this app. https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1041938
- NIST AM machine/process research addresses porosity, cracks, dimensional variation, residual stress and scan strategy. https://www.nist.gov/programs-projects/am-machine-and-process-control-methods-additive-manufacturing

## Current code boundary (2026-10-01 release audit)
Working: STL upload/viewer; bounding geometry, triangle metrics, approximate watertightness; generic AM screening; fuselage-only analytical structural screening and parameter search; manual validation state and research JSON export.
Missing: STEP/3MF parsing; true arbitrary-part FEA; orientation/support geometry; thermal distortion; qualified machine/material data; persistent evidence attachments; trained FTQ model; machine export.
Do not represent deployment Ready as engineering validation.

## User journey
1. New project → select classification/data handling; confirm authorization; name revision.
2. Upload STEP/STP (preferred BREP), STL (mesh), 3MF (mesh + metadata), optional IGES later. Show parser support explicitly, preserve original hash, source units, filename, conversion warnings. Do not silently convert unsupported files.
3. Validate geometry: bounding box, units, volume if watertight, connected components, normals, holes, nonmanifold edges, thickness estimates, cavities, inaccessible regions; flag confidence and mesh resolution.
4. Engineer defines intent: part role, functional interfaces and keep-out regions, protected surfaces, tolerances, load cases/boundary conditions, allowed design region, target process/material/machine, required inspection and postprocessing.
5. Feasibility gate: machine envelope, minimum walls/holes, recoater clearance, powder evacuation, support access, downskin risk and buildability. Unknown thresholds are shown as unknown, never guessed as qualified.
6. Orientation explorer: sample rotations, calculate transformed bounds, down-facing area, estimated support volume/access, build height, contact area, trapped powder risk and surface-criticality penalty. Show Pareto alternatives and explicit tradeoffs, not one unexplained score.
7. Optional structural workflow only when loads, constraints, material allowables and validated solver are configured. Otherwise show geometry/AM screening only.
8. Optional design alternatives: change only engineer-approved regions; maintain interface geometry and check all constraints; compare against baseline with revision diff.
9. Evidence workspace: input provenance, software/solver versions, machine/material profile revision, assumptions, inspections, test results, reviewer signoff.
10. Export **research build-readiness report** and structured JSON; machine-facing files disabled until adapter and lab validation/approval.

## Proposed architecture
- Frontend: retain Next.js/Vercel for projects, viewers, setup, alternatives, reports.
- Object storage: private versioned CAD/mesh artifacts with signed access, checksum, retention policy and access audit. No proprietary/Boeing-controlled uploads until approved environment.
- Database: projects, parts, immutable revisions, upload artifacts, geometry analyses, requirements, profiles, orientation runs, alternatives, simulation jobs, evidence, approvals, reports.
- Async worker: Python service using OpenCascade/pythonOCC or CadQuery for STEP/BREP; trimesh + mesh repair tools for STL/3MF; Gmsh for meshing; optional CalculiX/Code_Aster integration for explicitly scoped FEA. Separate sandbox/container, job queue, timeout, memory and file-size limits.
- Visualization: browser mesh viewer + per-face/triangle risk overlays, measurement tools and side-by-side comparison.
- Rules: deterministic versioned process/material checks with source, applicability, units, severity, evidence level and uncertainty.
- AI: retrieval/explanation and requirements assistance ONLY; all computed dimensions, checks, and ranked alternatives come from deterministic algorithms or explicitly identified validated models. Never invent loads, approvals, numerical FEA results, or process settings.
- Integrations: future machine-specific adapters behind allowlist and human approval. No direct generic G-code generation.

## Data contract (minimum)
PartRevision {id, projectId, parentId, fileHash, sourceFormat, units, geometryType, conversionStatus, geometryWarnings, createdAt}
Requirements {partRevisionId, loadCases[], fixtures[], keepOuts[], preservedInterfaces[], tolerances[], objectiveWeights, inspectionPlan}
ManufacturingProfile {process, machineId?, alloy, feedstockState?, envelope, ruleSetVersion, qualifiedWindowSource?, status:research|lab_verified|approved}
AnalysisRun {id, partRevisionId, inputHashes[], solverVersion, ruleVersion, assumptions[], metrics, findings[], confidence, status, errors}
Candidate {id, baseRevisionId, orientation, supportEstimate, objectives, constraintViolations[], evidenceLinks[]}
Approval {reviewer, scope, decision, timestamp, artifactHashes[]}

## Delivery phases and exit tests
**P0 — stabilize and measure:** CI build, unit tests, upload regression, saved-project reload, report gating, source-hash provenance; baseline screenshot/test fixture. Exit: no regression in existing STL and fuselage workflows.
**P1 — CAD-agnostic intake:** STEP worker, STL and 3MF loaders, explicit units, conversion, geometry quality, immutable revisions, safe file limits. Exit: 10 diverse sanitized test parts (bracket, manifold, duct, thin wall, lattice, enclosure, flange, heat exchanger, impeller, fuselage surrogate) open and metrics reconcile with independent CAD tool within documented tolerances.
**P2 — DfAM engine:** machine profiles, overhang heatmap, thickness sampling, trapped-powder/accessibility heuristics, candidate orientations and Pareto explorer. Exit: deterministic outputs on fixed fixtures, documented false-positive/negative cases, unsupported checks marked unavailable.
**P3 — engineering inputs and FEA adapter:** boundary condition editor, material source, mesh convergence checks, solver run and validation against analytical benchmark specimens. Exit: benchmark residual/error reported; no unsupported arbitrary-part structural approval.
**P4 — controlled design exploration:** protected geometry and parameterized design regions; regenerate candidates in CAD kernel; re-run all applicable constraints; rank by mass, support, build height and risk. Exit: preserved interfaces confirmed by geometric comparison.
**P5 — FTQ learning:** record machine/build/inspection outcomes and metadata; train/calibrate models only on sufficient approved data; cross-machine generalization and uncertainty/OOD testing. Exit: held-out performance and calibration reported.
**P6 — lab pilot:** exact printer/material, qualified profile, operator review, build package adapter and physical inspection loop. Exit: sponsor/lab signoff; still no implied aerospace certification.

## First engineering sprint (priority)
1. Add a format-capability registry and truthful upload UI: STL parsed, STEP/3MF queued/unavailable until worker is deployed.
2. Introduce part-revision IDs and SHA-256 provenance to prevent stale results.
3. Implement geometry-analysis job state (queued/running/failed/completed) and typed errors.
4. Add 10 public/synthetic fixture models plus golden-metric regression tests.
5. Build machine-envelope check and orientation ranking for watertight STL before advanced simulation.
6. Add result labels: measured / calculated / heuristic / simulated-unvalidated / validated / unknown.
7. Add sponsor questions page and data-governance gate.

## Risks and decisions
- Exact Boeing target geometry is not confirmed: avoid fuselage-specific product positioning; keep surrogate as a benchmark.
- Arbitrary uploaded CAD cannot imply arbitrary automated design optimization; optimization needs editable design parameters and explicit engineering constraints.
- Meshes generally lack native editable feature history; STEP/BREP is preferred for modification.
- Units are often missing in STL; force user confirmation.
- Geometry repair can change the design; retain original, log repairs and require approval.
- Security/export control is a gating requirement before external aerospace files are uploaded.
- ML first-time-quality predictions require machine-, material-, process- and inspection-specific measured outcomes.
- Build preparation and certification are distinct; reports must never claim approval.

## Sponsor decisions required
Approved data environment; target part(s) and permitted CAD format; machine/process/alloy; available loads and boundary conditions; CTQs and acceptance tests; allowed software/solver; permitted machine-interface exports; sanitized benchmark and experimental datasets; success metrics and review authority.
