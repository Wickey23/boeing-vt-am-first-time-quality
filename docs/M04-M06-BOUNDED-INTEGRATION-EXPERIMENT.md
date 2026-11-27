# M04–M06 bounded physical-layer integration experiment

## Current scope
The sampled STL raster is compared with independent directed triangle-plane section areas. The final partial layer uses its actual midpoint. M05 registers original CSV bytes to those physical layers, checks chronology, Z and traversed XY cells, and reports blocked/review-required states. M06 is an **offline integration experiment only**; no UI or production solver calls it.

## Predeclared numerical gates
- One closed, consistently oriented shell; verified original STL SHA-256 and source CSV SHA-256.
- 2–40 uniform full-height layers, 2–1,500 represented cells; no fractional cells are rounded to full density.
- Registration must have no blockers, including missing powered layers, ambiguous/empty paths and discontinuous chronology.
- Absolute relative sampled/reference section-area discrepancy at most 1% in every layer; sampled/mesh volume discrepancy at most 1%. These are chosen research screening criteria, not process tolerances or proven error bounds.
- Explicit research acknowledgment and supplied bounded material/thermal parameters.
- Existing finite-volume solver must pass its numerical energy balance and stability checks.

## Synthetic verification
Use the public 10 mm cube scaled to 1 mm, two 0.5 mm layers, four cells per layer, and three explicit CSV commands. Expected commanded energy 0.002 J, absorbed energy 0.001 J at 0.5 coupling, eight cells, relative energy imbalance below 1e-9. Reject wrong hash, wrong Z, missing acknowledgment and partial-height layers. Test execution remains subject to exact-head CI.

## Remaining acceptance
M04 still requires quantitative thin-feature, sleeve and rotated bracket accuracy and convergence; neither four-ray occupancy nor directed section area proves local fidelity. M05 still requires source-backed machine-to-model transforms and independent registration validation. M06 requires support for fractional geometry and appropriate physical boundary conditions, worker integration, progress/temperature visualization and benchmarked mesh/time convergence. M07 requires independent measured thermal traces and calibration/held-out validation. No melt pool, porosity, crack, residual stress or distortion prediction is established.

## M07 time-discretization diagnostic
Use fixed step scales 1, 0.5 and 0.25 of the existing stable/motion-limited step ceiling, with identical source bytes, material inputs and spatial cells. Record actual integration step counts, energy balance, final cell-temperature RMSE and maximum difference, peak-temperature differences, command-end maximum-temperature differences, and changes in heuristic consolidation state. The test requires strictly increasing step counts and energy conservation at all three scales; it does not assume monotonic errors or a theoretical convergence order because the cell-state update is discontinuous. No temperature-accuracy acceptance limit is assigned without a documented reference problem or independent experimental data. Spatial convergence and model validation remain separate gates.
