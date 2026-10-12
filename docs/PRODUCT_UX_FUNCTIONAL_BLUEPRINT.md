# CAD-Agnostic AM First-Time-Quality — UX and Functional Product Blueprint
Date: 2026-10-12
Status: design and implementation plan; no new application functionality claimed.

## Product positioning
Web-based engineering decision-support platform for uploaded CAD and metal additive manufacturing preparation, with traceable evidence and explicit limits. Target: approved non-proprietary/sanitized CAD for senior design until sponsor authorizes controlled data.

## Benchmark observations and sources
- Materialise Magics combines mesh/CAD preparation, repairs, positioning, supports, simulation and reporting: https://www.materialise.com/en/industrial/software/magics-data-build-preparation
- Materialise e-Stage for Metal+ v1.4 (June 2026) introduces multiple orientation candidates centered on print speed, nesting and quality: https://help.materialise.com/en_US/e-stage/e-stage_for_metal_plus
- Autodesk Fusion automatic orientation study compares orientations with optional precise support volume calculation: https://help.autodesk.com/view/fusion360/ENU/?contextId=MFG-AM-HOW-TO-AUTO-ORIENT
- nTop supports CAD, mesh and CAE data with reusable parametric engineering workflows: https://www.ntop.com/solutions/why-ntop/
- Ansys Additive Suite covers distortion, process, thermal and structural simulation: https://ansys.synopsys.com/products/additive/ansys-additive-suite
These are benchmarks, not implemented features.

## Information architecture
Top navigation: Projects | Engineering Workspace | Materials & Machines | Evidence Library | Reports | Help.
Within a project: Overview > CAD Intake > Geometry > Requirements > Manufacturability > Orientation & Supports > Controlled Optimization > Compare > Validation > Build Package.
Project status and currently selected revision persist across tabs; dependency changes invalidate downstream results.

## Desktop layout
Left: 220-260 px collapsible project navigation, process stage badges and revision history.
Center: dominant CAD viewer with orbit/pan/zoom/orthographic views, triad, ruler, section/cross-section, selections and overlay palette. Stable camera across stages.
Right: 320-380 px contextual input/results inspector with expandable sections; viewport never hidden by long forms.
Top bar: project, revision, units, state, save/restore and report action.
Bottom job panel: processing status/errors/assumptions and evidence links.
Responsive: mobile is viewing/approval-oriented; dense modeling and controls optimized for desktop.

## Screen-by-screen functional spec
1. **Projects**: list/search, new project wizard, last modified, latest geometry, warning counts, processing states, reopen and duplicate.
2. **CAD Intake**: drag/drop or browse; format registry; checksum, size, units, name, part count; STEP/STP via future CAD kernel, STL current, 3MF future; warnings; never pretend unsupported files parsed; choose sanitized sample data. Private uploads only after approved infrastructure.
3. **Geometry**: selectable model components; X/Y/Z, surface area, mesh volume with watertight caveat, bounding envelope, mesh integrity, components, feature/face tagging, critical surfaces and protected interfaces; overlays for anomalies; export findings CSV/JSON.
4. **Requirements**: intended function, material/process/machine, acceptance criteria, build envelope, tolerances, load cases and BCs, inaccessible regions, postprocessing access; request missing essentials explicitly, allow screening-only mode.
5. **Manufacturability**: severity-ranked findings anchored to model coordinates (thin walls, overhangs, enclosed cavities, powder escape, support and postprocess access); rule source, confidence and applicable machine/material; unknown thresholds marked unknown.
6. **Orientation & Supports**: candidate build orientations with support estimate, Z-height, projected build duration only when calibrated, contact access, surface sensitivity and heat-treatment risks; tradeoff table and Pareto frontier, manual override; support generation later.
7. **Controlled Optimization**: optimize only approved regions and parameterized geometry; immutable baseline, objectives weights, preserved interfaces, reproducible candidate provenance; no structural pass claim without configured validated solver and constraints.
8. **Compare**: side-by-side synchronized viewers, metric delta, per-constraint pass/warn/fail/unknown, selection reasoning and uncertainty.
9. **Validation**: evidence checklist, attachments with hashes, solver/test version, NDE/inspection measurements, predicted-vs-measured comparison, reviewer signoff. Manual checkboxes are not proof.
10. **Build Package**: research report PDF/JSON with inputs, rules, revisions, analysis provenance, assumptions, outstanding gates; actual printer-specific output disabled unless qualified and authorized.

## Main interaction
New Project > upload approved CAD > verify units and mesh/BREP > geometry health > define process/material/requirements > run DfAM screen > inspect color-coded issues > generate candidate orientations > compare tradeoffs > select candidate > add validated engineering evidence when applicable > export research report. A user may revisit and revise any step; all dependent analyses invalidate.

## Design principles
1. Geometry-first, not fuselage-first.
2. One interactive viewport, not separate unrelated model images.
3. Explicit statuses: not run, unsupported, screening, simulated-unvalidated, verified, requires engineer review.
4. Preserve uploaded source, hash and revision lineage.
5. Deterministic engineering calculations with source/rule versions; LLM assists interpretation and requirements but never invents numerical evidence.
6. Performance: streamed task progress, worker queue, bounded memory/time, cancel/retry.
7. Always display assumptions, units, data provenance and applicability.

## Practical architecture
Frontend: existing Next.js/Vercel retained for app UI, simple STL inspection and API gateway.
Geometry worker: Python OpenCascade/pythonOCC or CadQuery for STEP import/BREP meshing, trimesh/3MF parser, checks and conversion in sandbox. Stateless job infrastructure, private object storage and Postgres revision metadata.
Worker inputs: immutable artifact reference and declared units; outputs: GLB preview and structured metrics/findings with tool versions, never silently rewrite CAD.
Later: Gmsh meshing/CalculiX or Code_Aster benchmarked solver adapter; machine profiles and support/orientation algorithms; lab build outcomes for ML validation.
Security: approved environment, authenticated roles, access audit, encryption, bounded file size/complexity, strict parsers and data retention. No Boeing controlled data in public previews.

## Build order and acceptance tests
Sprint 0: fix preview reliability; secure Next.js supported patch release; add CI tests and branch protection; document working baseline.
Sprint 1: CAD intake and 3D viewer polish; reject corrupt/empty/oversized files; unit confirmation and SHA256; persist project revisions. Test ≥10 synthetic fixtures, repeatable metrics.
Sprint 2: STEP processing worker; BREP integrity, units, triangulated GLB preview, structured errors; verify using FreeCAD/CAD kernel source measurements.
Sprint 3: geometry overlay + manufacturability rules; check reproducibility, false positives, known failure fixtures.
Sprint 4: machine/material profile and first orientation Pareto candidates for STL and converted STEP; documented support estimator error.
Sprint 5: controlled geometry modifications and traceable compare; untouched interface checks; no unsupported arbitrary-part optimization claims.
Sprint 6: evidence capture, report gates, validation datasets and engineering review.
Only subsequently: validated FEA/process simulation, AI defect predictions, and authorized machine adapters.

## First UI delivery definition
Project home and upload route; file list with version; large interactive viewer and right-side metrics; warnings for invalid/incomplete parsing; save/reopen with private storage; tests and preview pass. Do not implement fake charts or placeholder AI results to imply working functionality.
