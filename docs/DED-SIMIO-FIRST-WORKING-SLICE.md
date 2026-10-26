# DED and Simio research workflow: first executable slice

Implementation branch: integration/ded-simio-working-slice-20261026. Based on main 30c2688.

## Implemented
- /simulation is now the Simulation Center; historical isolated structural/thermal benchmarks moved to /simulation/benchmarks.
- Model-specific DED **teaching wall** for laser wire-fed or blown-powder DED; unmodeled arc/electron beam variants intentionally absent.
- Editing nominal single-bead wall/substrate dimensions, assumed rectangular bead geometry, bidirectional vs one-way tracks, commanded deposition/traverse speeds and dwell. Generates one track per layer.
- Interactive 3D substrate, nominal wall and per-layer tracks; explicit note this path is **not** generated from an STL, even if a user has uploaded a different component in the saved workspace.
- Deterministic, reproducible commanded motion time with separate reposition time and dwell; bead-swept nominal volume, optional user-provided power/speed in J/mm; optional bounding-box **only** fit check. No robot reach/collision or qualified machine setting claims.
- Deterministic FIFO single-server, one-operation-per-resource manufacturing-flow *reference*, with user-labeled hypothetical setup, cooldown, machining and inspection durations, batch size and release interval. This is NOT Simio.
- Export one ZIP containing JSON scenario manifest; operations, resources, jobs, tracks and reference-results CSV; and README explaining how the team can create/import tables in a licensed Simio project.
- Scenario inputs saved to this device in localStorage, separate from uploaded STL analysis; versioned research-only assumptions remain visible.
- Unit, geometry, validation, reference-flow, CSV and ZIP regression tests, plus browser flow and export tests.

## What the test proves
The 60 mm long / 8 mm high illustrative wall with a 1 mm assumed layer increment produces 8 tracks, 480 mm deposition motion, 7 mm alternating repositioning, 96 s deposition, 0.35 s reposition and 70 s interpass dwell = 166.35 s commanded motion + dwell. These are hand-checkable motion calculations, not a verified real printer time estimate.

The reference DES is an exact deterministic capacity-one flow shop under stated simplified assumptions. It lacks downtime, shift calendars, empirically calibrated processing-time variability, real defect/rework rates, multiple resources per operation and batch equipment constraints.

## Next gates before external engineering use
1. Identify exact DED or LPBF process and actual machine, kinematics/nozzle/substrate and feedstock; this only supports a synthetic wall teaching geometry.
2. Replace simplified geometry with authenticated CAD-derived deposition region and machine-specific multi-bead paths, accessibility/collision analysis.
3. Physically verify process timing and machine availability before claiming factory feasibility.
4. Build actual Simio .spfx model with modeler-selected object mappings, data-table schema and CSV binding. CSV exports are not a runnable Simio file or simulation.
5. Add independent structural meshing with arbitrary mounting patches, transient thermal with verified energy/time steps, calibrated distortion and measured materials.
6. Use appropriate public and/or approved measured datasets, independent validation, sensitivity studies; current ML inference remains off.
7. An explicitly approved remote compute architecture and data handling before any proprietary CAD leaves user-controlled local space.

## Research references
- NIST AM Bench 2025 DED details: https://www.nist.gov/ambench/am-bench-2025-measurements-and-challenge-problems
- NIST AM Bench laser hot-wire benchmark descriptions: https://www.nist.gov/ambench/short-descriptions-2025-benchmarks
- Simio data import/export description: https://textbook.simio.com/SASMAA7/ch-data.html

## Safety and outcome scope
No production parameters are recommended by this interface. No machine command is generated. Software behavior and numerical tests are NOT approval to manufacture, demonstrate flight suitability or predict first-time acceptance.
