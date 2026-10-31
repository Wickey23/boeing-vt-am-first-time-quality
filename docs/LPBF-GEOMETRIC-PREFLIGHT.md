# ORIENTAI automatic LPBF risk preflight — source-derived geometry

## Workflow

1. Upload an STL (up to 20 MB); the existing local topology worker inspects it.
2. Confirm units and dimensions against an engineering drawing. Until this occurs, the geometry risk worker does not run.
3. The new **Automatic part risk preflight** panel appears in the main `/copilot` study and runs a **local** SHA-256-verified worker. It recalculates on mesh, units, selected orientation, envelope or angular screening changes.
4. Findings distinguish **geometric blockers**, **engineering review prompts**, and **unassessed physical failure modes**. Each measured finding states its numeric evidence and next engineering action.
5. For elevated downward-facing regions, **Highlight relevant STL triangles in 3D** illuminates the exact uploaded STL triangle indices in the source geometry; the selected orientation is used consistently by both engine and viewer.
6. Download a source-hashed JSON report including source identity, rotation, assumptions, areas, issue codes, geometric triangle IDs, and missing evidence. No STL bytes are uploaded to ARC.
7. The local chat guide directs risk/failure questions to this panel; the optional ARC interview receives a short textual summary of actual computed geometric findings under explicit user consent.

## Geometry definitions

The source is an STL mesh interpreted in engineer-confirmed millimeters. Rotations use XYZ Euler angles about the STL bounding-box center. The build-frame origin for contact assessment is the **lowest rotated STL vertex**; the app does not assume actual machine-placement and support-body geometry are known.

- **Mesh blockers**: boundary edges, nonmanifold/inconsistently oriented edges, disconnected shells (review).
- **Envelope blocker**: rotated axis-aligned bounds exceed the user-configured XYZ envelope (unverified machine input).
- **Elevated down-facing surface**: nondegenerate triangle has surface normal n_z < -sin(alpha), and centroid height > max(0.02 mm, min(0.2 mm, 0.0005 × part height)) above the lowest rotated vertex. Alpha is a user-configured screening angle, **not** a qualified process limit.
- **Bed-contact proxy**: downward-facing near-horizontal triangles (n_z < -0.9) entirely inside the same small near-bed tolerance. A zero value means no directly touching flat face detected; **it does not imply a supported build would fail**.
- **Support-volume proxy**: sum of elevated down-facing triangle area × |n_z| × centroid height. This is a geometric screening proxy (mm³), **not** generated support material or predicted support requirements.
- **Smallest STL edge**: warning only; neither thickness nor small-hole diameter is determined from triangle edge length.

The panel intentionally **does not** flag an ordinary cube's bottom face as an elevated overhang. A rotated cube yields elevated down-facing triangles requiring review, without asserting a defect will occur. Tests assert both cases.

## Scope and limitations

- No ray-occlusion test, generated supports, bridging feasibility, powder-trap classification, surface roughness or recoater deflection.
- No validated melt pool, lack-of-fusion/keyhole porosity, hot cracking, fatigue, residual stress, warping or anisotropy predictor.
- No pass/fail or failure probability. A clean geometric screen does **not** mean a print is safe or first-time quality is likely.
- Geometry results should be checked for topology validity and mesh resolution before engineering use. No controlled sponsor geometry/data should be shared to a public service without approval.
- All machine limits, material/process parameters, approved supports, quality acceptance and inspection requirements need separately verified source data.

## Evidence / tests

- `lib/lpbf-risk-preflight.ts`, `workers/lpbf-risk-preflight.worker.ts`
- `components/v2/RiskPreflight.tsx`, `components/ModelViewer.tsx`, `components/v2/ChatStudy.tsx`
- `tests/lpbf-risk-preflight.test.ts` validates unchanged cube, tilt, open STL, envelope blocker, unit/hash gating.
- `tests/browser/auto-lpbf-risk-preflight.spec.ts` validates auto-run after unit confirmation, JSON evidence, warning localization and 3D highlight.

## Reference framework

NIST shows that local geometric features/overhangs affect conduction and melt-pool behavior, but validating physical predictions requires thermal/process measurements and trustworthy machine/material parameters.

- https://www.nist.gov/publications/part-geometry-and-conduction-based-laser-power-control-powder-bed-fusion-additive
- https://www.nist.gov/programs-projects/metrology-am-model-validation
- https://www.nist.gov/programs-projects/additive-manufacturing-part-qualification

## Prioritized engineering follow-ons

1. Scan the sliced physical layers for isolated islands and scan-vectors pointing outside represented material, with correct source/coordinate-frame evidence.
2. Add physically meaningful, machine-specific support/anchor planning with actual STL/scan and human approval.
3. Import permitted material, atmosphere, feedstock and machine parameter envelopes; explicitly label defaults as examples.
4. Reconcile geometry preflight with real build orientation and scanned paths, run calibrated transient/thermomechanical models on selected candidates.
5. Benchmark with NIST AM Bench, quantify model uncertainty, compare pre-build warnings to measured defects and CTQ results before presenting a defect-risk score.
