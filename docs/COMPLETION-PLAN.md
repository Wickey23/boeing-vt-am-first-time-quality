# ORIENTAI completion and validation plan

Planning baseline: main commit 605ff8b; reviewed 2026-10-22. This document is a proposed implementation and acceptance plan, not evidence that the remaining capabilities are implemented or validated.

## Product outcome

An engineer uploads one component, defines its manufacturing process and service requirements, compares feasible build orientations, understands the evidence and limitations, and exports a reproducible engineering review package. First-time acceptance means meeting the agreed dimensional, material, structural and inspection requirements after planned postprocessing without unplanned repair or rebuild. Software supports that outcome; it cannot guarantee it.

Deliver two explicit releases: (1) a complete research engineering workbench with verified calculations and visible unavailable capabilities; (2) a validated pilot for a bounded material/machine/process/part family after physical testing. General aerospace qualification is outside these release claims.

## Baseline to preserve

- Local STL workspace, dimension confirmation, saved projects, portable project transfer, interactive geometry and orientation comparison, geometric constraints and estimates, JSON/PDF reports.
- Arbitrary candidate orientations and geometric Pareto comparison.
- Geometry-dependent steady thermal conduction and isotropic voxel elasticity, with restricted models and verification tests.
- Original-part end-plane service fixtures and XYZ total force, one case, displacement requirement, reactions and field display.
- ML research baseline, with inference withheld while provenance, unit and reproduction issues remain.

Not yet provided: general CAD/region fixtures, conforming production-quality FEA, qualified property cards, experimentally supported directional strength ranking, validated manufacturing distortion, fatigue qualification or first-time-success probabilities.

## User journey and terminology

1. **Add your part:** upload or choose a clearly labeled teaching example; see geometry, units, dimensions, integrity and checksum immediately. Repair requires a visible before/after comparison and new geometry identity.
2. **Describe its job:** mounting regions, loads, temperatures, cycles, critical surfaces and dimensional/displacement requirements. Users can select “unknown”; it creates a missing requirement, never a guessed value.
3. **Choose how to print:** machine/envelope, alloy and property source, process settings, plate/support assumptions, heat treatment, HIP and finishing. Show which selections have compatible evidence.
4. **Run analysis:** automatically run inexpensive checks once inputs are valid; show dependencies, progress and expected resource use for heavier jobs. Request geometry-transfer authorization before using an external worker.
5. **Compare options:** keep the actual part central, show baseline and alternative orientations, hard constraint outcomes, tradeoffs and evidence. Explain why an orientation is shortlisted and why another is rejected.
6. **Review and export:** include unresolved questions, engineering actions, frozen inputs/results, JSON and PDF. “Ready for engineering review” never means “certified to print.”

Use plain questions and visible next actions. Advanced solver controls stay in expandable panels. Legends always state units and model. Keep service loads in original-part coordinates; print direction, build plate and manufacturing conditions use an explicitly transformed build frame.

## Delivery packages and acceptance gates

### A. Unified project and requirements foundation

Create versioned records for Project, GeometryRevision, ManufacturingConfiguration, MaterialCard, LoadCase, Requirement, AnalysisRun, ResultArtifact and ValidationRecord. Separate user inputs from disposable analysis output. In particular, preserve service setup when orientation rankings are recomputed. Use immutable run snapshots, geometry/configuration hashes and dependency-based invalidation. Stale fields must never appear as current results. Provide local export/import, migration, deletion and recovery.

Gate: edits invalidate only dependent results; reload, navigation, cancellation, retry and export/import preserve the same geometry and requirements; stale worker responses cannot overwrite newer runs. Empty, invalid and partial-result workflows have clear next actions.

### B. Geometry and service-load definition

Add named load cases, stable original-geometry surface regions, clamp and supported displacement definitions, total force and pressure. Add distributed moments only with a tested force/moment mapping. Add bore/mounting-region selection, clear symbols and editable selections. Detect missing constraints, disconnected bodies, zero-area selections and load/fixture conflicts. Warn that rigid full-face clamps can create artificial stress concentrations. Do not silently approximate bolts or contact as a validated joint model.

Preserve STL support; investigate STEP through a licensed-compatible local or authorized meshing worker. Assess manifoldness, orientation, disconnected shells, thin features and units. Preserve region provenance through remeshing, and require reselection if correspondence is ambiguous.

Gate: selected physical regions and loads retain identity under every build rotation; force and moment resultants are conserved; underconstrained/invalid cases fail with actionable errors.

### C. Reliable solver execution

Keep browser workers for lightweight analysis. Pilot Gmsh plus CalculiX in a separate local or approved compute worker rather than assuming long solves fit the frontend hosting lifecycle. Confirm licensing, deployment resources and input support before committing to the stack. Use queued/running/succeeded/failed/cancelled states, bounded memory/time, cancellation, retries, idempotency, progress and solver logs. Retain reproducible input decks and solver/container versions.

Gate: cancellation releases work, retries cannot duplicate artifacts, timeouts and unsupported meshes produce structured errors, concurrent runs remain isolated. No proprietary geometry is transmitted without authorization. Approved remote operation needs access control, encryption, retention/deletion rules and redacted logs; browser storage itself is not a security boundary.

### D. Part-specific structural analysis

Implement conforming tetrahedral small-strain elasticity first, with multiple service cases, stress/displacement fields, reactions, equilibrium checks and mesh-quality diagnostics. Add yield/displacement margins only with compatible properties and declared requirements/safety-factor conventions. Treat peak fixture stresses and singularities explicitly. Add buckling, contact, plasticity or thermal expansion only as separately verified capabilities when the intended case requires them.

Gate: axial, bending and torsion benchmarks; rigid-rotation invariance for isotropic part-attached cases; reaction force and moment balance; at least three controlled mesh refinements on nonsingular quantities; independent reference comparison. Predeclare tolerances for each benchmark before evaluation and publish failures. Convergence of a numerical model is not experimental validation.

### E. Material and process evidence

Material cards record alloy, source and units, machine/process scope, powder condition where available, heat treatment, HIP, finish, service temperature, orientation, elastic/plastic/thermal data, specimen count/scatter and evidence status. Distinguish illustrative values, published means, calibrated values and approved allowables. Reject incompatible property combinations and retain source documents/checksums.

Gate: every assessed requirement can be traced to the exact property source and condition; missing data yields “not evaluated.” Begin a bounded Ti-6Al-4V pilot only if compatible data and physical test access exist; otherwise narrow the pilot to a supported combination instead of inventing coverage.

### F. Orientation optimization and risk screening

Retain geometric search and add reproducible coarse-to-fine arbitrary-angle refinement. Evaluate build height/layers, down-facing area, conceptual support/contact/accessibility, envelope including plate/support allowances, critical surfaces and machining/inspection access. Show build-time/cost assumptions and uncertainty. Filter violated hard requirements before preference ranking; unknown requirements are not feasible-by-default. Shortlist candidates for expensive simulation and return a Pareto comparison, not a universal score that hides violations.

Orientation-dependent structural ranking requires supported direction-dependent material/failure data or supported surface/defect/residual-stress effects. An isotropic part under unchanged part-attached loads has the same service response after build rotation; do not reward a fictitious strength change. Elastic anisotropy alone does not establish directional yield or fatigue strength.

Risk findings contain evidence type, affected region, inputs, rationale, limitation and suggested action. Separate geometric warnings, model estimates, physical simulation and experimental validation. Include overhangs, plate contact, envelope and access first. Thermal concentration, cracking, porosity, lack of fusion and keyholing require compatible evidence; volumetric energy density alone is not a general defect classifier.

Gate: reproducible rankings, constraint-first behavior, explicit unknowns, accurate transforms and Pareto tests. No claim that the finite search proves a global optimum.

### G. Thermal and manufacturing distortion progression

Retain steady conduction as a named educational/engineering approximation. Add transient conduction, temperature-dependent properties and verified boundary conditions before moving heat input. Layer activation, scan strategy, latent heat and plate/support conduction need separate verification and appropriate compute budgets. A moving-source conduction model still omits important melt-pool physics unless explicitly modeled.

Pilot calibrated inherent-strain distortion for a bounded process before expensive full thermomechanical LPBF. Include plate/support restraint, removal sequence and stress relief where supported. Evaluate open-source thermomechanical candidates such as adamantine against resources and data. Never substitute service stress for residual stress.

Gate: conduction analytical checks and energy balance; space/time refinement; held-out thermal histories, residual-strain and displacement benchmarks with compatible process conditions. Record calibration data separately from validation. NIST AM Bench is a candidate evidence source, not blanket validation across materials and machines.

### H. Reproducible ML, only where useful

Audit all 227 existing Ti-6Al-4V records and reconstruct the reported 178/49 split. Verify source units, duplicate/derived measurements, study identifiers and target definitions; reproduce Ridge/KNN and document discrepancies. Maintain source/license records and immutable raw/processed dataset hashes. Fit preprocessing only on training folds. Use study/build-grouped cross-validation for development plus an untouched external study for final evaluation where available; random row splits alone do not establish transfer.

Train simple baselines before complex networks. Report MAE/RMSE in physical units, per-study/per-process errors, sample counts and uncertainty coverage where supported. Register dataset, code, seed, environment, hyperparameters, model checksum, compatibility ranges and known failures. The inference API returns prediction, units, model ID, applicability and uncertainty status; it must abstain outside supported scope or when required inputs are missing.

Develop melt-pool models only for compatible melt-pool labels. Support-volume models require actual support-generation/build labels and generation-policy context. Distortion surrogates require calibrated solver or measurement labels, with synthetic and experimental data distinguished. First-time acceptance classification requires longitudinal build/inspection/rework outcomes and a predefined acceptance event; it cannot be trained from melt-pool width alone.

Gate: independent evaluation against predeclared engineering tolerances and a baseline, leakage review, reproducible artifacts and bounded inference. Small or incompatible data can legitimately leave a model experimental/offline. Training completion is not evidence of useful accuracy.

### I. Viewer, examples and engineering reports

Expose geometry/orientation, overhangs, conceptual supports, selected regions, service stress, displacement, thermal and supported manufacturing fields. Always show units, legend, source run and exaggeration factor for deformation; distinguish original and deformed shape. Disable unavailable fields with a reason. Optimize large geometry and dispose GPU resources.

Provide original parametric teaching examples: mounting bracket, lug with bore, thin wall/channel, sleeve and thermal coupon. Label them non-flight designs, provide dimensions/license/provenance and intended lesson. Include both successful and deliberately problematic geometries as regression fixtures. Examples do not supply training evidence unless real compatible labels are collected.

One JSON/PDF package includes checksum, geometry revision/units, inputs, requirements, candidate comparison, computed fields/statistics, solver/mesh/settings, material/model provenance, validation status, uncertainty, unsupported capabilities and engineering actions. Include machine-readable result references and no blank “passed” fields.

Gate: report and screen agree on every result and unknown; a second engineer can recreate a run from its input package. Keyboard/mobile usability, readable legends and beginner workflow tests pass.

### J. Physical pilot and release assurance

Predeclare acceptance criteria and an experimental design with manufacturing/test engineers. Cover orientations, repeated builds, plate locations and independent batches within available resources; determine replication from expected variability and the decision being tested. Record machine, powder lot, scan/process parameters, supports, postprocessing and deviations. Measure dimensions, deformation, relevant mechanical properties and inspection findings. Evaluate held-out builds, not calibration specimens, for claims of predictive performance.

Track observed first-time acceptance separately from predictions. Comparisons against the existing process must report sample sizes and uncertainty; no improvement claim from a few selectively successful parts.

Release gates: numerical/unit tests, real reference geometry integration tests, critical browser journeys, accessibility/performance checks, production build, CI, preview verification, migration/rollback test and production smoke verification. An authentication wall is a reported verification blocker, not a successful live test. Version all model changes and preserve previous run reproducibility.

## Execution sequence

1. A plus initial UX/report status work: independent input state, immutable runs, requirement/evidence statuses and clear next actions.
2. B and C: region selection, multiple cases and worker contract; E begins alongside the implementation work.
3. D: verified conforming service FEA, convergence and reports.
4. F and I: constrained orientation shortlist and complete engineering-review workflow.
5. H: baseline reproduction then bounded inference only if validation gates pass.
6. G: validated thermal/distortion pilot; start with available benchmark evidence.
7. J: physical pilot and release claims scoped to the evidence; feed results back into E/F/H.

Each package ships on an integration branch in reviewable increments with tests, documented limitations, verified deployment where appropriate and a rollback path. Package dependencies are gates, not permission to hide unfinished features. No calendar completion date is credible until solver deployment, compatible datasets and lab/machine access are confirmed.

## Definition of complete

**Research workbench:** end-to-end workflow, persistent traceable inputs, verified supported calculations, understandable comparisons, robust jobs, reproducible reports and explicit unsupported capabilities. Users can complete a representative engineering review without repeated uploads or unexplained steps.

**Validated pilot:** additionally, specified material/machine/process conditions, compatible property data, independent numerical and physical comparisons, predeclared acceptance thresholds and bounded model applicability. Users can see exactly which decisions are supported and which require separate analysis/testing.

## References for implementation research

- NASA AM qualification framework: https://www.nasa.gov/centers-and-facilities/nesc/nasa-additive-manufacturing-standards-support-human-spaceflight/ (reference framework; no claim of ORIENTAI compliance).
- NIST AM Bench: https://www.nist.gov/ambench/benchmark-test-data
- NIST anisotropic tensile review: https://www.nist.gov/publications/understanding-anisotropic-tensile-properties-laser-powder-bed-fusion-additive-metals
- Gmsh: https://gmsh.info/doc/texinfo/
- CalculiX: https://www.calculix.de/
- adamantine: https://adamantine-sim.github.io/adamantine/
