# AM First-Time Quality — System Architecture

## Mission
Reduce iteration in metallic additive-manufacturing rapid prototyping by linking engineering requirements, CAD, DfAM analysis, process planning, machine knowledge, build evidence and inspection feedback in one traceable workflow.

## End-to-end pipeline
1. **Requirements & CTQs** — dimensions, tolerances, interfaces, loads, surfaces, material and inspection requirements.
2. **AI-assisted CAD** — translate structured intent into parametric CAD operations; preserve parameters and design history.
3. **Geometry/DfAM analysis** — watertightness, thickness, unsupported regions, enclosed powder, minimum features, recoater/build-envelope risks.
4. **Orientation optimization** — multi-objective search over support burden, build height/time, thermal risk, critical surfaces and post-processing access.
5. **Support planning** — candidate support regions/strategies, removal access and thermal anchoring.
6. **Process planning** — material + machine + qualified parameter-envelope selection. No fabricated machine settings.
7. **Quality prediction** — combine geometry, process, machine and eventually sensor/history data to estimate defect/distortion/requirement risk with uncertainty.
8. **Build package** — immutable manifest containing source geometry hash, revision, machine/material profile, approved recommendations and export artifacts.
9. **In-process evidence** — later ingest layer imagery, melt-pool/thermal signals and machine logs where the target machine exposes them.
10. **Post-process verification** — CTQ dimensional inspection, NDE/CT, surface and material test results.
11. **Closed-loop learning** — compare prediction to inspection, version datasets/models, and recommend future changes.

## Application boundaries
- **Vercel/Next.js:** UI, workflow, APIs, reports, metadata, light geometry calculations.
- **CAD/geometry worker:** OpenCascade/CadQuery or equivalent service for STEP/BREP creation, healing, booleans, feature recognition and robust mesh analysis.
- **Optimization/ML worker:** Python service for DOE/Bayesian optimization/surrogate models once validated experimental data exists.
- **Object storage/database:** private versioned CAD, build artifacts, measurements and model lineage.
- **Printer adapter:** machine-specific interface. Must remain disabled until printer/controller/slicer and approved export workflow are known.

## Safety and qualification rule
The application is engineering decision support. A recommendation is never promoted to a qualified machine parameter merely because an AI/model produced it. Machine/material/process qualification, approvals and inspection evidence remain explicit gates.
