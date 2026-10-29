# ORIENTAI — Live milestone tracker

**Status:** initial inventory as of 2026-10-29, not a claim of implementation completeness. Update the checked gate evidence and source SHA after every verified change. Full contracts: [MASTER-MILESTONE-ROADMAP.md](MASTER-MILESTONE-ROADMAP.md). HCI checks: [hci/ORIENTAI-HCI-PROTOCOL.md](hci/ORIENTAI-HCI-PROTOCOL.md).

Legend: **Continuous** = repeated throughout development; **Partial** = some code exists but contract isn't met; **Not started / Planned** = feature or release gate not complete; **Next** = current engineering development target; **Blocked by evidence** = external data/model/experimental prerequisites.

| ID | Workstream | Baseline status | Next required verifiable evidence |
|---|---|---|---|
| M00 | Fresh repository, team-safe collaboration and CI | Continuous | New main/PR/CI audit at each work session |
| M01 | Canonical immutable project and evidence | Partial | Cross-tool source/run identity and invalidation tests |
| M02 | HCI-reviewed chat-first part workspace | Partial | Real usability test + grounded UI state tests |
| M03 | STL/CAD and original-part regions | Partial | Geometric provenance and golden fixture tests |
| **M04** | **Physical STL layer slicer** | **NEXT** | Actual STL → physical slice geometry/volume/registration tests |
| M05 | Physical scan & material bindings | Partial | Source-hashed scan-to-slice registration |
| M06 | Approved partial-layer worker + viewer | Not started | Verified STL/scan worker + playback + approval gate |
| M07 | Independent numerical V&V | Partial | Analytic reference cases and controlled refinement |
| M08 | Thermophysical phase and powder fidelity | Research baseline | Phase/material model validation and resolution |
| M09 | External measured thermal validation | Exploratory only | Matched predeclared independent benchmark |
| M10 | Conforming service-load FEA | Partial | Mesh-converged loads, reactions, references |
| M11 | Print distortion and residual stress | Not started | Calibration and held-out deflection/strain |
| M12 | Geometric manufacturability risk mapping | Partial | Real annotated part-region golden tests |
| M13 | Defect-specific prediction with uncertainty | Blocked by evidence | Independent mechanism-specific validation |
| M14 | Constraint-first alternatives and optimization | Partial | Hard-requirement and Pareto regression |
| M15 | AI planner, evidence and approved tool execution | Partial | Full chat-to-worker-to-report end-to-end test |
| M16 | ML provenance/OOD and inference | Research only | Grouped held-out validation + applicability bounds |
| M17 | Build and inspection outcomes feedback | Not started | Linked real build/CTQ/inspection records |
| M18 | DED and production flow/Simio distinct track | Optional, PRs open | Review and reconcile #8/#9, process separation |
| M19 | Durable jobs and approved secure storage | Partial | Isolation, retry, access and deployment checks |
| M20 | R1/R2/R3 release acceptance | Planned | Separate functional, physics and operations signoffs |

## Immediate work package: M04 + HCI groundwork

- [x] Audit latest repository/main, CI and open relevant PRs; keep existing code.
- [x] Publish master milestone definitions and acceptance criteria.
- [x] Publish HCI protocol and initial **code-inspection** review (not usability-test evidence).
- [ ] Inspect geometry/core mesh and decide real slice/partial-cell coverage representation without silently treating coarse voxel slices as physical layers.
- [ ] Add pure geometry slicing/registration module with explicit unit/origin/rotation parameters and limits.
- [ ] Add reference cube, hollow body, thin feature and rotated geometry unit/volume regression tests; document tolerances before testing.
- [ ] Export an actual geometry slice preview/coverage report, with no physical solver claimed until trustworthy.
- [ ] Write HCI state diagram and short technical terms explaining real physical slice vs coarse voxel slab.
- [ ] Only after geometry checks pass, implement M05 scan binding and M06 worker.
- [ ] Record `npm test`, `npm run typecheck`, `npm run build`, browser tests, CI SHA, deployment SHA and scientific limitations.

### Update template

```markdown
Date:
Milestone:
Current main SHA / PR overlap:
Change(s) + source SHA:
HCI task and finding status:
Numerical/reference evidence:
Unit / TS / build / browser / CI:
Deployed SHA (if confirmed):
What still cannot be claimed:
Next dependency:
```

## Release definitions

- **R1** is complete only when another engineer can reproduce an actual uploaded-part research review, all unsupported physics is explicit, and HCI/accessibility evidence is recorded.
- **R2** is complete only when bounded independent physical measurements establish defined performance with uncertainty and applicability constraints.
- **R3** requires explicit secure platform, data and organization approvals; do not infer aerospace qualification.
