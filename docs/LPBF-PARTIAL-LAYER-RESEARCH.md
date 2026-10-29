# Experimental Partial-Layer Powder/Consolidated Thermal Model

**Status:** Research-only numerical model. No experimental calibration or validation, STL slicing integration, melt-pool prediction, defect probabilities, build acceptance or aerospace qualification.

## Purpose

The independent `lib/lpbf-partial-layer.ts` model tests a physical-layer-aligned **finite-volume numerical prototype**, using the previously defined `PhysicalScanPlan` chronology. It does not replace the 1D physical-layer enthalpy stack, the coarse 3D transient solver, or their approvals. The current version is a library-only scientific component, **not a UI-executable validated printer simulation**.

The input grid is supplied by an engineer or test fixture as `[x,y,layer]` integer cells with uniform XY pitch and physical layer height. It is not silently manufactured from the existing much coarser voxelized STL; any future actual-STL adapter must slice geometry into physical layers with demonstrated geometry and volume conservation and audit powder/solid geometry.

## Numerical model

- At the first scan command for a physical layer, the entire layer's represented footprint is activated as powder at ambient temperature. This is **instantaneous powder deposition**, not partial powder spreading.
- Positive-power laser commands use their true relative timestamps and XY endpoints. Each integration substep samples beam position at its midpoint. A finite-radius Gaussian kernel is **renormalized to represented cells**; a powered beam with no represented footprint is rejected instead of depositing heat remotely.
- Cells illuminated by the modeled laser are relabeled `consolidated` without a physical phase-change criterion. This is a **geometric heuristic only**: no actual melt fraction, solidification path, porosity, density change, latent heat or powder shrinkage is calculated.
- Powder and consolidated cells use different constant effective thermal conductivities. Both states use identical fixed effective density and specific heat. Thus a cell's internal energy is `E = rho * V * Cp * (T - T_ambient)`; state changes do not insert or remove energy.
- Face flux uses the harmonic mean conductivity at powder/consolidated interfaces, with equal and opposite pairwise energy updates. Top and side exposed faces exchange with ambient via convection; bottom cells exchange with a fixed-temperature ideal plate. The powder outside the represented footprint is **not simulated**; convection is only a proxy boundary.
- Explicit forward Euler time steps are bounded by a conservative conductance/capacity estimate and by commanded laser motion (< one-third XY cell pitch per substep). The current limits are at most 1,500 cells, 40 physical layers, 3,000 commands and 120,000 integration steps.
- The numerical residual audits `absorbed laser energy - plate exchange - convective exchange - stored energy`. Signed plate/convection terms allow heating from the environment. This audit does not prove a correct physical thermal field.

## Provenance and safeguards

Requires SHA-256-shaped part and scan identities, registered layer Z values, chronology starting at zero, continuous coordinates/times, explicit laser-off transitions between layers, bounded speed/power, no duplicate grid cells, and a connected physical-layer grid. The caller is responsible for actually computing and checking the supplied SHA-256 values against source bytes and for proving grid-to-STL identity; a matching hash-shaped string alone is **not** source verification.

Results contain commanded and absorbed energy totals, residual, per-command time/state snapshots and final cell temperatures. Material constants and cell geometry are supplied inputs rather than machine presets or Boeing-certified properties.

## What remains

1. Compare numerical reference conduction, finite-volume energy balance, time-step refinement, and powder/solid interface cases against independent solvers.
2. Add an STL physical-layer slicer and voxel-volume coverage audit before linking this grid to a user-uploaded part.
3. Engineer-review and consent-gate the new inputs, verify actual source hashes in a dedicated worker, and visually distinguish powder/solid state without labeling cells as experimentally melted.
4. Extend to temperature-dependent properties, physically sourced powder-bed heat transfer, phase-change kinetics and thermo-mechanical coupling with measured, registered NIST AM Bench inputs.
5. Never turn conservation or visually plausible temperature fields into asserted porosity, cracking, melt-pool dimensions, first-time yield or flight readiness.

The older 1D physical-layer stack and legacy 3D moving-source models remain separate and are not automatically upgraded by this library.
