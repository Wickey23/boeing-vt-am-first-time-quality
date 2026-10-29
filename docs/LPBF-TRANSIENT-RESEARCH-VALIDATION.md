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

## Experimental moving Gaussian raster and enthalpy (lpbf-raster-enthalpy-0.1)

An optional model now generates an **idealized serpentine raster** over the occupied voxel slab's rectangular bounds. It applies a discrete Gaussian beam input to newly activated solid cells, with laser motion limited to at most half a thermal voxel per explicit step. It uses a **conservative enthalpy method** to capture reversible latent heat across a *user-supplied* solidus-to-liquidus interval. These are research approximations, not calibrated melt-pool predictions.

For each cell, H(T) = c_p(T - T_ambient) + L clamp((T - T_s)/(T_l - T_s), 0, 1). The scheme updates cell energy by Gaussian-deposited input, neighboring face conduction, convective exchange, and the idealized build-plate reservoir, then inverts the monotone enthalpy law to calculate temperature. All coefficients are held constant; molten flow, recoil, vaporization, surface deformation, powder thermophysics, radiation, contact resistance, phase kinetics and grain evolution are omitted.

The numerical Gaussian radius is broadened to at least **half the voxel width**, because the browser-scale grid cannot resolve most realistic LPBF laser spot radii. Beam energy is distributed over the occupied virtual slab and conservatively normalized; its drawn path is *not* a true physical laser hatch or slicer output. The virtual scan repeats across aggregated coarse deposition slabs, does not represent contours, scan islands, skywriting or layer-by-layer machine timings, and has no experimentally demonstrated accuracy.

**New controls:** Choose *Moving Gaussian raster + latent heat (experimental)* in the chat's LPBF research panel. The selection resets engineering approval. Inputs include beam radius, liquidus and latent heat as well as base thermal/process inputs. The output uses the same bounded worker timeline and part-specific temperature viewer, with a distinct engine version in JSON exports.

**Verification:** automated checks include a two-cell energy balance, a raster-direction test, Gaussian weight normalization, solidus/liquidus enthalpy inversion, latent-heat effect, no-laser equilibrium and positive-energy convergence. End-to-end browser checks verify a newly authorized moving-source run, export identity and invalidation on switching back to the simpler solver.

**Validation still required:** NIST AM Bench 2022 IN718 multiple scan paths and single-track data, and AM Bench 2025 thermal/track/pad benchmarks offer candidate measurement targets once the solver is able to represent the required geometry, scan patterns and material conditions. Comparison is not claimed at this stage. See https://www.nist.gov/ambench and https://ambench2022.nist.gov/ . NIST's 2025 research 'The trace of heat: on the predictive power of modeling transient diffusion' also motivates a calibrated conduction-plus-phase-change approach: https://www.nist.gov/publications/trace-heat-predictive-power-modeling-transient-diffusion .

**Next fidelity work:** import an authorized real slicer scan plan, resolve beam-to-voxel size with adaptive/finer mesh, represent powder-solid contrasts and temperature-dependent coefficients, add appropriate surface losses and boundary conditions, run mesh/time-step/spot-size convergence, compare with experimental thermal measurements, and only then consider coupling to structural distortion and defect models.

## Imported CSV virtual-slab scan plans (research interchange v1)

The LPBF panel now offers an additional **Imported numerical CSV laser segments (experimental)** mode. This replaces the generated serpentine raster with ordered segment records. The CSV stays local in the browser. The exported research record includes its SHA-256 hash, filename, segment count and schema version. Preserve the original CSV separately to reproduce the run.

**Exact header:** slab,x0_mm,y0_mm,x1_mm,y1_mm,power_w,speed_mm_s

Each row describes a straight commanded traversal in **millimeter coordinates in the uploaded STL's original model coordinate frame**. The slab index is a *zero-based occupied thermal voxel-slab index*, NOT an actual printed physical layer number. This research tool does not automatically map a real 20–100 μm physical layer onto a coarse thermal slab. Laser power 0 W means laser-off traversal; travel contributes to time but no applied laser energy. Segment ordering matters.

The parser rejects missing/extra columns, malformed or nonfinite values, zero-length segments, unordered slab indices, out-of-bounds speeds/powers, oversized CSV input (256 KB or 2,000 segments). The numerical worker rejects missing slab tracks, coordinates outside STL X/Y bounds, unsupported disconnected solid, and powered spots beyond supported solid geometry (rather than depositing heat over unknown powder). It enforces bounded computation time and iterations.

**Not a native machine job importer.** NIST HDF5, CLI, G-code and real slicer files are not supported directly. They require deliberate conversion into these virtual-slab coordinates and a reviewed transformation of units, origins, layer mapping, scan order, power, velocity and timing. NIST instrument trigger values must not be assumed to be seconds without documentation.

### Public synthetic example

The non-sensitive research fixture is public/verification/cube-10mm-research-scan.csv. It pairs with public/verification/cube-10mm.stl, millimeter units and thermal resolution 6. It alternates powered toy tracks with laser-off return travel over six virtual slabs. This is **not** an authentic production recipe, Boeing part, machine scan file or validated experiment. Engineer approval remains required.

### Evidence and numerical validity

SHA-256 proves byte identity of the input CSV used by the browser, not machine provenance or calibration. Verify authorized source, coordinate frame, layer grouping, executed laser on/off states, settings and measured results independently. Passing numerical energy accounting is not physical validation or mesh convergence. The export does not include full surface-field arrays, so preserve source STL and scan CSV.

NIST AMB2022-01 includes complete layer scan strategy HDF5 data with X, Y, commanded laser power and instrument triggers, and documents laser-off skywriting. Future benchmark import should explicitly map those data and their metadata before quantitative validation.

Reference: https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems

**Next:** compare a consistent physical scan plan at multiple spatial/time resolutions and against measured thermal histories, with documented material/beam and boundary conditions. No defect probability or qualified part assessment follows from this importer.
