# ORIENTAI implementation and engineering scope

## Baseline audit
Production was READY at 778a77b9; preceding b580e668 failed a TypeScript click handler. Orientation and simulation pages duplicated file/worker state; report read unrelated fuselage state. Only 24 rotations were searched; contact objective incorrectly minimized plate contact. Thermal/structural capabilities were disconnected analytic benchmarks. No package lock or test script existed.

## Implemented
- Shared root provider with active STL, configuration, candidate, run UUID, checksum and results. IndexedDB persistence on the user's browser; explicit clear and storage error handling. No part geometry uploaded by the unified workflow.
- Local worker automatic geometry analysis, debounced setting changes, progress, timeout, cancellation, stale-result suppression.
- 24 orthogonal plus default 72 deterministic low-discrepancy quaternion rotations, adjustable to 360 extra. This is finite sampling, not a guaranteed global optimum. Minimize projected-area support proxy and height; maximize plate contact. Feasible-first ranking and Pareto filter.
- Source units, layer count, machine envelope, critical triangle area, explicit constant per-layer time and machine occupancy cost assumptions. Critical face indices are diagnostic, not an additional score objective.
- Actual STL voxelization with closed oriented manifold checks. Steady conduction uses cell-centered finite volume, isotropic constant conductivity, bottom-plane Dirichlet temperature, top-plane heat flux and otherwise insulated boundaries. Jacobi-preconditioned conjugate gradients, residual and energy-balance reporting.
- Linear tetrahedral elastic FEM (six tets per occupied voxel), explicit E/nu, global bottom clamp, top X/Z load, consistent triangular boundary load integration. Reports element von Mises maxima, nodal displacement maxima and residual. Surface maps are nearest-cell averages, labeled as such.
- Physics jobs require review of illustrative inputs. Material name does not silently select qualified properties. Thermal and structural runs are tied to part run UUID and candidate. No physical metrics influence orientation scores yet.
- One report with JSON and downloadable client-generated PDF; captured configuration, all candidates, findings, performed solvers, omitted capabilities, ML provenance and engineering review requirements.
- ML rerun: 227 / 178 / 49, Ridge MAE 37.465293413900966 reproduced; KNN 20.781126116769663 vs historical 20.60453342264126 unresolved. Dataset checksum, finite-value cleaning, study disjointness, cross-split duplicates, runtime versions and Ridge parameters recorded. Source units unverified, inference disabled.
- Next.js 15.5.28, lockfile, numerical regression tests. Legacy fuselage viewer loaded client-side to preserve build compatibility.

## Verification scope
Automated tests cover box rotations/contact/support, envelope and units, invalid settings, exact thermal slab solution and energy conservation, voxel refinement, zero load, disconnected geometry rejection, exact uniaxial elastic bar and STL field-array correspondence. These verify selected numerical cases, not general solver accuracy or experimental LPBF validity.

## Limitations and next work
- Voxel resolution limited to 6–24 thermal / 6–12 structural; thin aerospace walls and cavities may be unresolved. Manifold checks do not detect every self-intersection. Replace with conforming, quality-controlled tetrahedral meshing for serious engineering use.
- Linear tetrahedra can lock or over-stiffen bending. No yield, plasticity, anisotropy, buckling, fatigue, contact, fixture picking, or nonlinear/large-deformation analysis. Service loads are expressed in build-oriented coordinates.
- No transient laser/deposition solver, residual stress, process distortion, melt-pool field, keyhole/lack-of-fusion, porosity, cracking or validated probability.
- No experimental validation, aerospace qualification, certification or first-time-quality claim.
- Solvers run locally in workers. No durable server queue, multi-project organization or multi-user access control. Browser data is not an encrypted engineering vault; clear local data on shared devices. Legacy standalone research pages are not the unified part workflow.
- Reports retain the most recent thermal/structural run only, with its candidate ID; selecting another orientation does not transform or reuse that field. A formal mesh-convergence study/history is still needed.

## Residual-stress implementation path
Evaluated primary sources: CalculiX (https://www.calculix.de/ and https://github.com/Dhondtguido/CalculiX) and MOOSE heat-conduction/solid-mechanics coupling (https://mooseframework.inl.gov/). CalculiX offers a plausible batch FEM integration path; MOOSE supports more extensible multiphysics development but needs substantial worker infrastructure. Neither is installed or invoked by this release.

Next: conforming mesh + boundary selection; temperature-dependent k/cp/rho/E/nu/expansion/yield/hardening datasets with provenance; transient laser scan and layer activation benchmarks; sequential thermoplastic coupling; support release and plate removal; calibrated inherent-strain comparison; coupon thermography, displacement and diffraction validation. Run expensive jobs in an explicitly approved local worker or controlled backend, with signed run manifests and checksums. Do not derive residual stress from the current steady temperature field.

Additional data candidates: NIST AM-Bench (controlled benchmark comparisons), NIST AM material data already audited in ml/, BaratiLab MeltpoolNet (melt-pool labels). Compatibility, license, process and unit review precedes training. None supplies automatic support-volume labels; obtain slicer labels on actual CAD geometries for that task.
