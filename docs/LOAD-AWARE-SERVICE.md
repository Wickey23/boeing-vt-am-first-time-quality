# Load-aware service study — first implementation increment

## Implemented

- Original STL axes (after conversion to millimetres) define service conditions. Candidate build rotation does not change the structural mesh, fixtures, forces or scalar fields.
- Users select one of six extreme end planes to clamp; a uniform total X/Y/Z force is distributed over the opposite extreme voxel faces.
- ModelViewer transforms original-part boundary schematics and a force-direction arrow with the same transform as the geometry. Bounding planes are schematic, not selected CAD faces. Arrow length is illustrative.
- One service case and optional maximum displacement requirement are saved with the active analysis, revisions and portable project. Editing setup invalidates the old structural field and mesh-sensitivity result.
- JSON and PDF include model inputs, coordinate frame, fixture/load boundaries, force reactions, equilibrium residual, displacement assessment, mesh and limitations.
- Legacy build-frame results remain explicitly identified in reports. The new field selector requires original-part results; rerun old service studies.
- No geometry leaves the browser. Worker cancellation and timeout remain supported.

## Governing model and verification

Small-strain homogeneous isotropic linear elasticity, six linear tetrahedra per occupied voxel, SI-derived N/mm/MPa units. Fully constrained extreme-plane nodes; equal-area face triangles distribute the total service force. Diagonal-preconditioned conjugate gradient, relative linear-system residual 1e-8, maximum 4000 iterations. Mesh limited to 6–12 voxels across the longest dimension.

Tests cover an analytical axial bar with zero Poisson ratio, all six fixture orientations, signed forces and reaction equilibrium, load and geometric scaling, zero load, disconnected geometry rejection, exact build-rotation invariance in original-part coordinates, displacement requirement states and persistence/invalidation in the browser. These tests verify a restricted implementation; they do not experimentally validate a component.

## Interpretation

Isotropic service stress does not provide an orientation-dependent strength ranking. A missing requirement is not evaluated. A displacement within a user limit means only that the simplified numerical model satisfies that limit. No yield/fatigue/buckling margin or manufacturing pass probability is generated.

Voxel end faces may differ from actual geometry, erase thin features and introduce artificial fixture concentrations. Linear tetrahedra may be too stiff in bending. Nearest-cell stress colors are not surface nodal stress. Two mesh resolutions are a sensitivity check, not proof of convergence. Material properties are illustrative and unvalidated.

## Remaining phased work and gates

1. General service setup: named load cases, original-part face/region selections, pressures and moments, fixture validation and UI symbols. Gate: preserve region identity under build transforms and reject underconstrained cases.
2. Conforming mesh and solver pilot: evaluate Gmsh + CalculiX using a local/approved worker; support controlled geometry repair, mesh diagnostics, job progress/cancellation and reproducible solver inputs. Gate: analytical benchmarks, reaction equilibrium, mesh convergence and reference-solver agreement on a mounting bracket. Do not assume every STL can mesh automatically.
3. Traceable material/process cards: alloy, machine, source, heat treatment/HIP/surface condition, temperature, build/test directions, scatter and data status. Gate: compatible sourced properties; distinguish means from approved allowables.
4. Direction-dependent performance: validated tensor rotation and a separately supported failure criterion. Gate: matched-direction experiments and held-out validation. Do not infer anisotropic strength from elastic constants alone.
5. Constrained multi-case optimization: geometric filter, expensive shortlisted simulation, requirements before support/time/cost preferences, Pareto explanations. Unknown evidence must remain unknown.
6. Manufacturing distortion: calibrated inherent-strain feasibility study, build plate/supports/stress relief/removal sequence; then thermal-mechanical process simulation if justified. Gate: benchmark residual-strain/deflection comparisons with stated process compatibility.
7. Fatigue and physical validation: applicable load spectra, surface state and fatigue data; repeated coupon/part builds across orientation and plate location; acceptance protocol agreed before testing. Track observed first-time acceptance separately from predictions.

## Research references

- NIST anisotropic tensile properties review: https://www.nist.gov/publications/understanding-anisotropic-tensile-properties-laser-powder-bed-fusion-additive-metals
- NASA qualification framework (reference, not a claim of applicability or qualification): https://www.nasa.gov/centers-and-facilities/nesc/nasa-additive-manufacturing-standards-support-human-spaceflight/
- Gmsh: https://gmsh.info/doc/texinfo/
- CalculiX: https://www.calculix.de/
- NIST AM Bench IN718 LPBF residual strain and deflection: https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems
- NIST AM Bench 2025 fatigue data (surface/heat-treatment compatibility required): https://www.nist.gov/ambench/am-bench-2025-measurements-and-challenge-problems
