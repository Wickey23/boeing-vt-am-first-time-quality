# LPBF Transient Heat-Flow Research Prototype

**Status:** Numerically checked research approximation, **not experimentally validated** and **not a defect predictor**.

## What is implemented

The current chat-first workspace provides a dedicated engineer-approved LPBF transient worker. The solver starts from an uploaded closed, manifold STL with the engineer-confirmed unit conversion, reuses the repository's geometry-dependent voxelization, advances a time-dependent energy balance on the active solid voxels, and adds an assumed absorbed laser-energy input for each **coarse virtual slab**. The UI shows live worker progress, a timeline of finished slabs, temperature fields on the part surface, and conservation/validity diagnostics. An export action produces a traceable JSON summary with SHA-256 model identity, selected unit scale, exact approved input values, model version, conservation totals, timestamp, per-slab trace and limitations; full temperature contour arrays are not included in the exported summary.

The model is *not* a production LPBF finite-element build simulation. The physical layer thickness affects the assumed nominal layer count and scanning/recoating schedule, while each thermal slab represents one voxel-height group, often many printed layers. The laser heat is **uniformly distributed across the newly activated slab over its assumed total scan time**; the code does not process a physical scan path or a localized moving heat source.

The validated-context goal is to progressively replace this lumped layer source with machine-specific scan-path heat inputs, then phase change, powder/solid property differentiation, radiative losses, improved mesh resolution, thermomechanical coupling and calibration.

## Governing conservation equation

For each active voxel with side length h (m), density rho, specific heat c and solid thermal conductivity k:

- Cell thermal capacity: C = rho c h^3 (J/K).
- Face conduction to an active neighbor j: k h (T_j - T_i) (W).
- Ambient convection on a missing/exposed voxel face: h_c h^2 (T_ambient - T_i) (W).
- Simplified build-plate contact at bottom occupied voxel: 2 k h (T_plate - T_i) (W).
- Applied laser coupling to the currently activated slab: P_absorbed = eta_effective P_laser, divided uniformly among its active new cells during scanning.

With a constant physical layer thickness t, hatch spacing s, scan speed v and coarse slab occupied volume V, the assumed scan duration is V / (s t v). It omits turnaround moves, skywriting, contour passes and cross-hatching. Nominal recoating time is the nominal physical-layer count multiplied by a user-supplied dwell. For explicit time steps:

C (T_i^{n+1} - T_i^n)/dt = sum(face conduction) + sum(convective faces) + plate exchange + uniform deposition input.

A conservative safety factor is applied to the explicit thermal stability bound; energy accounting checks supplied energy against stored energy and heat exchanges. Numerical energy balance is necessary but **not** sufficient to establish accurate temperatures or convergence.

## Required engineer-reviewed inputs

Laser power, scanning velocity, hatch spacing, nominal layer thickness, an **effective retained energy-coupling fraction** (not an experimentally measured absorptivity by default), recoating time per layer, material density/heat capacity/conductivity/solidus, initial environment and plate temperatures, convective heat-transfer coefficient and voxel resolution.

The initial titanium-alloy-like values in the frontend are **illustrative demonstration inputs only**. They are not machine presets, qualified parameters, Boeing design requirements or independently verified properties. The user must confirm geometry units and explicitly acknowledge the parameter assumptions before a run.

## Implementation limits

- Closed consistently oriented two-manifold STL, up to 2 MB and 6,000 triangles; research mesh resolution 6 to 16; no disconnected islands without build plate connection.
- Uniform, isotropic, temperature-independent solid properties; no powder conductivity, latent heat, fluid flow, evaporation or radiation.
- Instantaneous coarse slab activation, uniform energy absorption, no localized laser-tracking or spatial hatch exposure sequence.
- Temperature at or above the supplied **solidus** is outside the model's validity. **Do not infer melting temperatures, keyhole behavior or any defect probabilities.**
- Simplified external boundary conditions and stair-stepped discretization; exposed voxel faces including cavities share the same ambient convection assumption.
- The solver is bounded in time and step count; if the numerical resolution/complexity is not computationally safe it declines to run.
- Surface overlay uses nearest occupied-voxel projection; it cannot resolve finer local temperature gradients than the voxel mesh.
- No experimental validation, mesh-convergence study, calibrated material/process coupling or demonstrated LPBF predictive accuracy yet.

## Verification strategy

Automated checks assert rejection of invalid inputs, initial and zero-energy equilibrium, conservation accounting after nonzero laser input, and bounded geometry-dependent snapshots. Browser tests check that no thermal study starts before explicit human approval, and that changing the file's physical scale invalidates displayed fields. The existing service-load/steady-thermal regression suite remains separate.

The next **validation** stage is to acquire publicly available controlled NIST AM Bench measurements and the associated geometry, process settings and material measurements. Choose a compatible challenge where measured time-above-melt or cooling rates are available. The present solid-state model **cannot yet be compared credibly** to those melt-pool observables; a higher-fidelity moving-source and phase-change model must first be implemented. For earlier numerical verification, compare transient slab cooling against analytic conduction/cooling reference problems and perform voxel-mesh/time-step convergence.

## Risk modeling and communication

The failure-mode matrix marks **coarse solid-state LPBF heat flow** as calculated when the worker succeeds. Independently, validated scan-path thermal history, print distortion, porosity, cracking, fatigue and recoater behavior all remain **not assessed**. The UI must never show a "safe to print" decision or defect probability sourced only from this worker.

## Public technical references

- NIST AM Bench overview: https://www.nist.gov/ambench
- NIST AM Bench 2022 LPBF benchmarks: https://www.nist.gov/ambench/am-bench-2022-challenge-problems-and-measurement-results
- NIST direct AM Bench data and reference guidance: https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance
- NIST, *The trace of heat: on the predictive power of modeling transient diffusion*, 2025: https://www.nist.gov/publications/trace-heat-predictive-power-modeling-transient-diffusion

**Security:** Use only authorized, non-controlled test STL geometry and manufacturing inputs in this research demonstration. Do not upload confidential Boeing design data to public GitHub, public examples, or external AI services without explicit institutional approval.
