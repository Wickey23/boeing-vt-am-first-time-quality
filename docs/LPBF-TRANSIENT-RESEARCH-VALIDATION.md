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

## Numerical sensitivity checks — not experimental validation

The experimental moving-raster and imported-path research models now expose a separate, *optional* numerical sensitivity check after an engineer has explicitly approved and run the baseline. Each comparison runs in its own cancellable browser worker and publishes an actual numerical result only when the calculation is complete.

- **Time-step sensitivity:** rerun the *same* STL, physical units, approved thermophysical inputs, effective Gaussian source and original scan plan with half the original maximum explicit time step. Report baseline/candidate step counts, absolute difference in observed peak temperature, final mean temperature, and RMS difference between final surface-projected temperature samples, as well as absorbed energy difference. This is a one-level time-step sensitivity measurement, **not** a time-step convergence proof.
- **Generated-raster voxel sensitivity:** attempt a second run at the same commanded physical inputs with 2 additional voxels along the longest axis, bounded by the research resolution limit of 16. The virtual slabs, effective numerical Gaussian beam width, and total discretization can change, so this is only an indication of spatial sensitivity. It is **not** a controlled mesh-convergence or grid-convergence index (GCI) calculation.
- **Imported-path spatial sensitivity:** explicitly omitted. The imported CSV uses virtual thermal slab indices bound to the original voxel discretization. Switching voxel grids changes the number of virtual layers and invalidates the input scan plan. A physically defensible remapping from real deposited layers is required before comparing meshes.
- **Failure/expense safeguards:** each research solve retains the maximum-size, step-count and runtime caps, and the sensitivity operation times out and cancels rather than inventing a missing result. Spatial checks that cannot run are marked *not reported* with the reason, not a zero-error or passed result.
- **Provenance:** results can be exported to a JSON record containing the part SHA-256, unit scale, original inputs, optional uploaded scan SHA-256, model version, numerical cases and metrics. Full temperature fields are not included. Preserve the original STL and scan CSV files.

**Interpretation:** Two discretizations do not establish convergence, and agreement between two runs of the same unvalidated equations does not show agreement with an actual printed part. The solver remains a coarse virtual-slab approximation with unresolved laser-beam spots and unverified material/beam assumptions. Under no condition does the sensitivity result establish defect probabilities, an aerospace qualification, or first-time build quality.

**Experimental validation route:** NIST AMB2022-01 reports thermal time-above-melt and cooling-rate benchmark challenges on IN718 parts, with published HDF5 machine scan commands and measurement/uncertainty caveats. Before a quantitative comparison, build a documented mapping from physical layer data to the numerical domain and use calibrated beam and material properties. Direct data and source guidance: https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance and https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems .

## Exploratory registered surface-temperature trace comparison

The chat research panel now includes an optional **Measured thermal trace — comparison readiness** section after a thermal worker completes. This is an experimental data readiness and numerical discrepancy feature, **not** an AM Bench model-validation result.

### CSV input and registration

Required exact UTF-8 CSV header: `time_s,temperature_c,uncertainty_c,x_mm,y_mm,z_mm`

Supply 3–1,500 strictly increasing readings. Each row contains observed °C, a positive stated temperature uncertainty °C, and the SAME measured position in the uploaded STL's original millimeter-aligned coordinate frame. Times must be seconds from the same origin as the simulation. The user supplies a reference/instrument or synthetic source, classifies synthetic or reported-physical data, and explicitly approves spatial and time registration. These declarations are **not authenticated**. No clock offset is fitted.

The tool finds the nearest original STL vertex and rejects locations farther than 0.75 of a thermal voxel width from a vertex. Proximity does not demonstrate that an instrument or thermography pixel is registered to that surface vertex. Model temperatures are compared only at valid post-activation snapshot times; out-of-range readings are excluded without extrapolation and at least three overlapping readings are required.

### Computed discrepancies

Report includes compared/unmatched counts, geometric registration distance, voxel width, peak model snapshot interval, mean absolute error, RMSE, signed model-minus-trace bias, and a descriptive count within user-reported uncertainty. All paired readings and limitations can be exported to JSON alongside part and trace SHA-256, supplied provenance and model settings. These are **exploratory discrepancies only**, never an accuracy grade or certified acceptance test. A synthetic self-check with near-zero RMSE demonstrates no independent predictiveness.

### NIST AMB2022-01 compatibility gate

NIST AM Bench 2022 TAM is **local time above a melting threshold**, and SCR is **solid cooling rate from specified thermal threshold crossings**. The official definitions require spatially registered high-speed thermographic temperature histories and careful emissivity/solidus assumptions. ORIENTAI currently saves coarse END-OF-VIRTUAL-SLAB fields, missing the fast laser pulse/solidification thermal history. Simple interpolation cannot recover those observables. This feature MUST NOT be called a comparison to CHAL-AMB2022-01-TAM or CHAL-AMB2022-01-SCR.

The app also does NOT parse raw AM Bench HDF5, authenticate source references, calibrate a thermal camera, align clocks, or independently verify reported measurements. The source filename and DOI are user claims. Measured uncertainty does not account for model uncertainty. No defect probability, cracking, residual stress, first-time-quality certification, or aerospace qualification can follow from this feature.

**Future actual benchmark validation:** map NIST physical layer scan vectors and camera registration to the model, retain high-rate local thermal histories, resolve beam-scale gradients and cooling events, use measured IN718 material/beam/powder properties and perform uncertainty-aware comparison to the benchmark's exact TAM/SCR definitions.

NIST challenge definitions: https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems
NIST dataset DOI and citation guidance: https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance

Privacy: uploaded STL and CSV bytes remain in the local browser; the JSON export includes the original-file SHA-256 identities, declared source metadata and comparisons but not the raw source CSV. Retain both original files for independent review.

## Solver-step internal thermal voxel probes and nominal physical-layer index mapping

The moving-raster and imported-CSV LPBF research modes now offer an optional **Run internal thermal probe** calculation. It reruns the original approved inputs and identical part/scan plan in an independently cancellable browser worker. The worker verifies uploaded STL bytes against the approved part SHA-256 and checks that the original model mode, parameters and imported path hash match the baseline before simulating.

The user specifies a point (x_mm, y_mm, z_mm) in the STL's original, engineer-confirmed millimeter frame. The tool chooses the closest **occupied thermal volume voxel CENTER**, rejecting points farther than 0.9 voxel widths. This is *not* an arbitrary surface finite-element sample, registered camera pixel, independent thermocouple position, or experimentally calibrated location. The output reports voxel-center coordinate and offset, activation time, internal voxel width and data classification.

Within each numerical integration step, the solver evaluates the thermal voxel's enthalpy-based temperature, tracks its exact **numerical-step maximum**, and records an ordered, bounded history for the chart/CSV. To avoid excessive memory, a deterministic stride based on the estimated step budget reduces recorded samples (up to roughly 2,050 points), with additional activation/end-of-slab samples. The recorded-sample maximum may miss narrow model transients, while the independent per-step maximum captures only those resolved by this **coarse explicit integrator**. Neither represents a physically resolved laser spot or measured melt-pool thermal peak.

The output includes virtual-slab number, elapsed model time (s), internal voxel temperature (°C), commanded scan power (W) and laser-on status. A CSV exports these samples; a separate JSON exports source part/scan SHA-256, solver version, material/scan assumptions, probe location and offset, sampled data, numerical energy accounting and validity limits. Data stay in the local browser unless exported deliberately.

### Physical-layer geometry correspondence

The moving-source calculation also supplies a geometric **nominal layer index manifest**. Based on uploaded STL build height and the user-entered nominal physical layer thickness, each hypothetical layer CENTER is assigned to the virtual voxel-height slab containing it. The manifest records original nominal layer indices for every occupied slab and flags nominal layer centers that fall outside modeled solid slabs.

This grouping **does NOT import or reconstruct physical machine scan commands**. It cannot preserve the sequence, machine-time delays, laser-off travel, volume-overlap deposition, dynamic powder bed state, physical layer cooling or hatch orientations when multiple real layers are aggregated into a single thermal slab. It must not be used automatically to convert real G-code/HDF5 layer paths into valid laser heat input. Until a layer-consistent physics representation exists, the imported CSV format continues to use *virtual* slab indices only.

### Verification and remaining limitations

Numerical tests compare runs with and without a probe to ensure sampled observations do not change energy deposition or temperature solutions; verify laser-on/off signals, monotone sample timestamps, active-voxel tolerance, interval spacing/peak tracking, invalid coordinate rejection and complete layer-index partitioning. Browser tests execute a source-hashed imported scan, probe run and downloaded trace on the public 10 mm cube test geometry.

**NOT NIST AM Bench validation:** The NIST AMB2022-01 challenge computes time above the midpoint of solidus/liquidus temperatures and solid cooling rate after crossing the solidus at specified spatial locations, using high-speed thermographic profiles. ORIENTAI's internal coarse-volume voxel history has neither the required spatial beam resolution, physically correct powder/phase-change physics nor independently registered thermography to score those observables. Do not compute a 'NIST passed' label or aerospace qualification result from this research output.

Official NIST reference: https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems

## Physical-layer absolute-time scan chronology audit

The LPBF research card now exposes a collapsed **Physical-layer laser schedule — timing audit (not simulated)** section. This audit is intentionally separate from the moving-source enthalpy worker. It accepts an engineer-provided UTF-8 CSV of ordered *physical layer* commands; it does not import native machine jobs, assume NIST HDF5 conventions automatically, or change the temperature model's original virtual-slab inputs.

**Required exact CSV header:** `layer,z_mm,t0_s,t1_s,x0_mm,y0_mm,x1_mm,y1_mm,power_w`

Each command declares a nonnegative physical layer integer, physical Z in the original STL-aligned millimeter frame, absolute start and end times in seconds relative to a declared clock origin, start/end laser XY in mm, and commanded power in W. Model `power_w=0` movements and stationary dwells explicitly. Timestamps must begin at zero and remain contiguous without hidden gaps or overlaps; scan positions must be continuous, including laser-off repositioning. A change in physical layer Z requires the new layer to begin with a zero-power command.

**Audit checks:** strict numeric CSV schema, max 256 KB/3,000 commands, finite physical bounds, monotonic time/layer/Z order, supported speed and power ranges, powered XY within the uploaded STL bounding box, and no unaccounted jumps. These checks validate the *declared command chronology*, not the actual executed motion or whether the laser was over solid or powder in 3D. The local WebWorker independently verifies the original STL SHA-256 and computes the imported CSV SHA-256.

**Reported outputs:** number of physical layers, nominal count for the part height, omitted layer indices, laser-on and laser-off durations, total commanded laser energy integrated as the sum of `power_w × (t1_s - t0_s)`, maximum commanded speed, layer-by-layer energy/time, and the coarse thermal voxel slab containing each physical layer's nominal Z center. A mismatch between physical heights and nominal layer-index spacing creates a warning, not a correction. Physical layers that cannot be assigned to occupied thermal voxels are explicitly marked unrepresented.

The audit exports a traceable JSON record with part/source hashes, all layer metrics, the separately completed virtual-slab model's assumptions and computed time/absorbed energy for context, and the machine-readable status `NOT_APPLIED_TO_COARSE_THERMAL_SOLVER`. **These energy quantities refer to different calculations and must not be compared as model validation or merged without a physically consistent layer-activation and heat transfer discretization.**

A public non-proprietary example at `public/verification/cube-10mm-physical-scan.csv` has fifty synthetic 0.2 mm physical layers over the 10 mm cube, explicit powered horizontal strokes, zero-power returns and zero-power dwells. It is NOT a physical printer file, Boeing recipe, machine-qualified scan job or NIST source dataset. It is purposely separate from `cube-10mm-research-scan.csv`, which uses six coarse *virtual* slabs.

### NIST AM Bench relationship

NIST AMB2022-01 includes 312 physical-layer scan groups in a native HDF5 `/XYPT/` structure containing XY positions in mm, commanded power in W and digital trigger values sampled at a **documented 100 kHz** command rate (10 microseconds per element). The commanded trajectory may differ from the executed trajectory due to galvo/laser dynamics. That metadata must be interpreted explicitly and transformed into this CSV's *absolute-time* format; raw HDF5 is not supported. This standalone preflight does not claim parity with NIST scanning, powder physics, melt-pool measurements or their TAM/SCR challenge metrics.

Source: https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems

**Next fidelity step:** implement physical-layer-by-physical-layer material activation, partial voxel occupancy, beam-scale thermal coupling, powder/solid interfaces, and time-stepped cooling between actual events. Only after numerical mesh/time convergence and experimental correlation should the imported physical chronology become an input to a predictive process-thermal simulation.
