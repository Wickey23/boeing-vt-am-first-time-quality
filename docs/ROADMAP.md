# Implementation Roadmap

## Phase 1 — Working digital thread (current)
- Web workspace and STL viewer
- Structured part intent and parametric seed CAD
- Material/process knowledge objects
- Deterministic DfAM/risk engine with confidence and rationale
- Downloadable seed STL

## Phase 2 — Real geometry intelligence
- Parse STL/3MF and calculate dimensions, volume, area, normals and mesh health
- Thickness sampling and feature-risk map
- Overhang/support heat map
- Build-envelope and orientation search
- Geometry revision compare

## Phase 3 — Production CAD service
- Python CadQuery/OpenCascade worker
- STEP/BREP import/export and healing
- Prompt/requirements-to-parametric-feature plan
- Constraint checks and CAD regeneration
- Topology/generative candidates only inside user-defined design space

## Phase 4 — Process optimization
- Versioned machine/material profiles
- Qualified parameter envelopes supplied by lab/sponsor
- DOE import, build-history dataset and inspection outcomes
- Surrogate models + Bayesian/multi-objective optimization
- Uncertainty estimates and out-of-distribution detection

## Phase 5 — Printer integration
- Confirm exact machine, controller, firmware/board, slicer/build-prep software and supported file/API formats
- Build read-only capability discovery first
- Generate vendor-compatible build package only through validated adapter
- Approval gate before any machine-facing artifact

## Phase 6 — First-time-quality feedback loop
- In-situ telemetry ingestion where available
- Anomaly detection and layer/build quality evidence
- CTQ inspection/NDE result capture
- Predicted-vs-actual quality dashboard
- Retraining/evaluation pipeline with model registry and immutable lineage
