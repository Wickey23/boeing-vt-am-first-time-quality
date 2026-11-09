# ORIENTAI process-correct engineering specification: usable metal DED and LPBF workflows

**Decision document** — design specification for implementation, not proof a printer or simulation is supported.
**Baseline:** repository main `30c268840875ee779832aae05d116a652fcc810c` (2026-10-26).
**Related:** `docs/COMPLETION-PLAN.md` and `docs/INTEGRATED-SIMULATION-DED-SIMIO-PLAN.md`.
**Review checkpoint:** confirm actual team/Boeing target process, feedstock, machine/software, part family and data-handling restrictions before calling any machine-specific capability "working."

## 0. Core product decision

ORIENTAI is not generic "find the strongest print angle" software. It is a traceable decision workbench for **a selected metal AM process, machine configuration, candidate part and stated engineering requirements**.

Use a discriminated process model:
1. `PBF_LB_METAL` — laser powder-bed fusion, powder bed + recoater + layerwise scanning.
2. `DED_LB_POWDER` — laser DED with blown powder (coaxial/off-axis nozzle).
3. `DED_LB_WIRE` — laser DED with wire (including a distinct hot-wire modifier).
4. `DED_ARC_WIRE` — arc-wire deposition / WAAM (different electrical/arc, gas, interpass and robot parameters).
5. `DED_EB_WIRE` — electron-beam wire deposition (vacuum/beam requirements).
6. `UNCONFIRMED` — onboarding only, no process feasibility/pass claims.

Initial implementation support target: **LPBF existing geometry screening** plus **generic DED substrate/path screening** for powder-/wire-fed laser deposition, only where the required profile inputs are entered. Arc and electron-beam DED should be selectable as explicitly `NOT_IMPLEMENTED` until adapters are built. No fake defaults or inherited laser-specific rules.

**Pilot selection** is a separate decision:
- If sponsor/lab machine details and permitted samples exist, use that exact variant and condition.
- Otherwise, start with a **public NIST AM Bench 2025 laser hot-wire Alloy 718 wall/substrate teaching and benchmark problem** for software design. AMB2025-04/05 describe process variables, deposition G-code and thermocouple/deflection measurements; verify the requested dataset is actually released/accessibly licensed before using it. NIST explicitly warns that the challenge does not provide material properties, so those must be independently sourced and condition-reviewed.
- Keep Ti-6Al-4V melt-pool research-only ML separate; do not transfer its model to DED Alloy 718 or PBF machine properties.

## 1. Why the UI and math must be process-specific

| Concern | Laser powder-bed fusion | DED wire/powder |
|---|---|---|
| Source material | powder spread across full layer | wire or blown powder supplied at moving deposition head |
| Target geometry | part + build plate + supports + enclosed cavities | deposited bead region on substrate or existing component; near-net shape and machining stock |
| Orientation | feasible build direction and support/contact | part/substrate orientation *and* machine/head approach, deposition path, stand-off and accessibility |
| Layers | recoater layer thickness | track/bead width, height, overlap, step-over and layer/track scheduling |
| Timing | recoating plus scan and setup | deposited travel, traverse, purge, turns, dwell, changeovers and finishing |
| Constraints | recoater clearance, powder removal, support and plate, gas flow | robot/machine kinematics, nozzle collision/reach, deposition angle, substrate/clamp, path continuity and shielding |
| Thermal | multiple scanned tracks on bed + plate conduction | localized moving feed/heat source, bead activation, substrate conduction, interpass cooling |
| Downstream | depowdering, plate separation, support removal and heat treatment | substrate separation, stress relief, machining to nominal, NDE/inspection |
| Evidence | cannot use DED bead data as LPBF model validation | cannot use LPBF powder-bed overhang rules as validated DED rules |

Optimization `candidate` must therefore be `{partRevision, processProfile, machineProfile, substrateAndFixture, orientation, depositionStrategy, finishingRoute, serviceRequirements}`, not just rotation angles.

## 2. Required engineering questions

### A. Part and intent (mandatory)
- Is this **new-build** DED or **repair/addition** onto an existing substrate? For initial workbench, support new-build only. Repair needs original damaged geometry/material compatibility and more detailed evidence.
- Upload STL; accept STEP only once CAD B-rep parsing and boundary identity are verified. Ask user to confirm mm/in and real dimensions.
- Identify intended nominal geometry vs **as-deposited envelope**, machining stock, target datum, critical bores/interfaces/surfaces and physical orientation.
- Surface/solid mesh health: closed manifold and connected bodies for volume methods; DED deposition-region geometry may need separate substrate and bead/path representation. Do not imply any arbitrary STL has a physically feasible DED path.

### B. Engineering performance (mandatory or explicitly unknown)
- Define at least one service case and attachments: physical fixture regions and load regions, force/pressure/torque, relevant service temperature and requirements (displacement, strength, tolerance, finish/fatigue).
- Distinguish required properties from known sourced properties. Missing material allowables -> `NOT_EVALUATED`, never a passed strength claim.
- Keep all loads in **part coordinates**. Build orientation transform affects manufacturing and material-direction representations, not physical service load attachment.

### C. Process identity and machine (mandatory to claim "feasible")
- Select exact process variant, system make/model, machine axes or robot model, working volume and feedstock delivery (powder or wire; hot-wire option only when appropriate).
- Record energy source type and nominal range, qualified parameter envelope reference, tool/nozzle geometry + stand-off, wire approach angle or powder nozzle type, access and clearance, travel and positioning limits, shielding/vacuum conditions where applicable.
- Process-specific machine limits and motion profiles must come from sources/operator input; placeholder values are `illustrative`, not verified.
- If kinematics are unknown, show `HEAD_REACH_UNVERIFIED` and do not claim print feasibility.

### D. Deposition and postprocessing strategy
- Substrate dimensions, location and material, clamp/sacrificial-fixture and baseplate removal.
- Bead width and height, step-over/overlap, track raster/contour strategy, number of layers, ordering, nominal speed, energy input, feed rate, interpass dwell/maximum temperature if measured/configured.
- Planned milling/turning, heat treatment/HIP, NDE, surface finishing and dimension tolerance *after* machining. Separate machining stock from removed volume and yield.
- For nonqualified settings show profile entry/validation rather than suggesting a "recommended" power/feed speed.

## 3. Engine inputs and result schemas (v1)

Keep strict units, tagged unknown values and references; `undefined` must not be coerced to zero. Implement schema validation before calculations.

```ts
type Evidence = "illustrative" | "numerically_verified" | "calibrated" | "independently_validated";
type ProcessKind =
  | "PBF_LB_METAL"
  | "DED_LB_POWDER" | "DED_LB_WIRE"
  | "DED_ARC_WIRE" | "DED_EB_WIRE";
type SourceValue<T> = { value: T; units: string; sourceId: string; evidence: Evidence };
type ProcessProfile = {
  id: string;
  kind: ProcessKind;
  machineId: string | null;        // null = no machine-specific feasibility conclusion
  feedstock: { alloy: string; form: "powder" | "wire"; conditionId: string | null };
  parameterEnvelopeId: string | null;
  processDataVersion: string;
};
type MachineProfile = {
  id: string; kinematicsSourceId: string | null;
  buildWorkspaceMm: { x: number; y: number; z: number };
  axes: string[]; headEnvelopeId: string | null; clearanceMm: number | null;
  minTravelSpeedMmS: number | null; maxTravelSpeedMmS: number | null;
};
type DedDeposition = {
  strategyId: string;
  substrateRevisionId: string;
  substrateMaterialConditionId: string | null;
  layers: Array<{index: number; zMm: number; tracks: Array<{
    id: string; pointsMm: Array<[number,number,number]>;
    speedMmS: number | null; energyW: number | null; wireOrPowderFeedRate: number | null;
    feedRateUnits: "kg/h" | "mm/s" | null; sourceId: string | null;
  }>;}>;
  bead: { widthMm: number | null; heightMm: number | null; overlapFraction: number | null; evidenceSourceId: string | null };
  interpassDwellSeconds: number | null;
  releaseAndMachiningRouteId: string | null;
};
type SimulationResult = {
  runId: string; candidateHash: string; engineId: string; engineVersion: string;
  state: "READY"|"RUNNING"|"SUCCEEDED"|"FAILED"|"STALE"|"UNSUPPORTED";
  evidence: Evidence | null;
  outputs: Array<{name:string;value:number|null;units:string;sourceId:string|null}>;
  warnings: Array<{code:string;severity:"info"|"warning"|"blocking";description:string}>;
  assumptions: string[]; limitations: string[]; inputHash: string; artifactIds: string[];
};
```

Actual implementation can use Zod/TypeScript or equally strict schema runtime validation. `machineId:null` means `feasibility unknown`, not `fits`. v1 serialization must include part geometry hash, coordinate frames, mesh/path identity and provenance. Never accept arbitrary user-provided executable deposition code for automatic machine execution.

## 4. Staged calculations (do not confuse models)

### Tier A: geometric/path-based (first implementable, minimal physics)
- Validate user machine/envelope, substrate attachment and oriented *deposited* envelope including head clearance only when geometry known.
- Estimate nominal deposition track length: sum of nontraverse centerline segment lengths.
- Estimate **ideal commanded deposition time** as sum(segment length / commanded speed), plus *separately stated* turnaround/dwell/start/stop/setup assumptions. Without speeds, show duration unknown.
- Estimate nominal deposited bead-swept volume only with sourced bead cross-section assumption; detect excessive overlap/collisions as geometric flags, but don't label internal voids/lack-of-fusion probabilities without data.
- Optional mass continuity check if feed mass flow, density and capture efficiency are sourced; powder capture efficiency and wire conversion differ.
- Compute linear energy input only where applicable: commanded source power / travel speed has units J/mm, but **does not determine defect risk or melt-pool dimensions by itself**, and must not become a universal pass criterion.
- Report path preview, unreachable segments, uncovered nominal regions, extra stock estimate and provenance.

### Tier B: supported thermal physics (after verification)
- Transient conduction `rho*c(T) dT/dt = div(k(T)*grad(T)) + Q(x,t)`, with declared domains (part, activated bead and substrate), boundary fluxes, convection/contacts and initial conditions.
- Activate material following deposited path and time schedule, with an explicitly defined reduced moving heat source that can account for known process efficiency. This does not automatically simulate melt-pool fluid flow, phase changes, keyhole, porosity or metallurgical failure.
- Time/space refinement and energy budget. Validate against relevant thermocouple data at coordinates/frames that truly match the model.
- Missing input values block calculation or reduce claims; no fabricated exact temperature map.

### Tier C: distortion/structural physics (after compatible data)
- Conforming service-load FEA: fixed/loaded regions, reactions/force+moment equilibrium, mesh refinement.
- Manufacturing distortion: separately calibrated inherent strain or thermomechanical strain model, substrate and fixture release sequence, thermal properties, and postprocessing effects.
- No stress or strength claims from geometric support score; no equality between service stress and residual stress.
- Anisotropic constitutive data and build-direction strength predictions require compatible material, machine, condition and coupon results.

### Tier D: production flow (Simio)
- Convert each feasible/conditional candidate to operations: prep -> deposition -> cooldown -> release -> heat treatment -> machining -> inspection -> optional rework/rejection.
- Respect shared resources, queue times, shifts, availability, setup/changeover, batch size and stochastic process duration. Do not infer manufacturing failure probabilities from height or heat input proxy.
- Exchange source-tagged scenarios via CSV/manifest and import replication statistics. When Simio is not available, use a clearly branded reference discrete-event simulation, not fake Simio output.
- No machine commands or unsupervised control in ORIENTAI.

## 5. The exact user interface behavior

**Guided steps** (part stays visible):
1. **Part:** upload geometry; verify dimensions and manufacturing intent.
2. **Job:** define performance requirements/mounting and unresolved questions.
3. **Process:** show LPBF vs DED variants, explain actual differences; choose exact variant or leave `unknown` and restrict analyses.
4. **Hardware:** choose known machine, substrate and feedstock; show machine applicability state and any missing profile data.
5. **Strategy:** create candidate orientations and, for DED, deposition paths/track order, machining allowance and fixture. Preview nozzle/head/part/substrate in the 3D view.
6. **Simulate:** independent service FEA, process thermal, distortion and factory DES cards; each card exposes inputs, job state, evidence and unavailable reasons.
7. **Decide:** constraints and results compare only **comparable** candidates; reject failed constraints, mark unanswered critical requirements `NOT_EVALUATED`, show Pareto outcomes.
8. **Export:** frozen report and machine-readable project, Simio scenario tables, output fields/limitation and validation checklist.

Example decision text (correct):
- `DEPOSITION PATH CHECK: completed for illustrative head geometry; real machine reach remains unverified.`
- `DEPOSITION TIME: 34 min ideal motion estimate, excludes setup/cooling/repair; speed user assumed.`
- `THERMAL HISTORY: not evaluated; material properties and energy absorption information missing.`
- `SERVICE DISPLACEMENT: numerical verification only; uploaded load/fixture assumptions must be reviewed.`
- `PILOT PRINT READINESS: engineering review required; no validated first-time-quality probability.`

Forbidden UI text until real validation: `Guaranteed quality`, `Optimal strength`, `Boeing approved`, `Print success: 98%`, `Safe for flight`, `Manufacturing-ready` merely from a successful calculation.

## 6. First demonstrator, concretely

**Example:** public/non-proprietary laser hot-wire DED nickel superalloy 718 single-wall build on substrate; use benchmark **geometry and measurements only if released and licensed**. Use NIST AMB2025-04/05 as literature reference, not as automatic approved manufacturer settings. A simpler internally generated wall/track/substrate teaching fixture can be used until raw benchmark files and materials are available.

Manual inputs in demonstration: wall nominal dimensions (explicit sample geometry), substrate dimensions, 2–3 toolpaths/scan ordering alternatives, user-labelled nominal bead footprint, speed and dwell *illustrative*, a service-load fixture/force *illustrative*, downstream finishing/inspection process times *illustrative*.

Expected demonstrable sequence:
1. Open sample wall with separate substrate frame. Reject invalid units or missing substrate.
2. Choose laser-wire DED. Switching to LPBF resets DED-only strategy as stale but preserves part requirements.
3. Preview path segments and deposition order; impossible head envelope fails with reason.
4. Run ideal path/time estimator; verify sum of segment lengths and time against hand calculations. Display uncertainty/assumption source.
5. Generate manufacturing route and CSV/manifest, import sample DES results, compare setup and machining bottleneck and confidence intervals for repeated simulation.
6. Structural solver shows **verified basic model** or `NOT_EVALUATED` for unknown fixtures; thermal & distortion remain disabled until verification and material data are ready.
7. Compare path A/B for travel, deposition time and factory lead time, with unresolved properties visibly marked.
8. Export report with untouched unknowns, geometry/process/input hashes and recommendations for tests.

Real success is that another team member can repeat all eight steps from a fresh browser and independently reproduce the hand-check numbers, *not* the existence of attractive color maps.

## 7. Correctness-focused tests (implement before release)

| Test | Pass/fail specification |
|---|---|
| Process switch | Switching LPBF/DED invalidates process-dependent results, not part-frame service cases |
| Feedstock compatibility | Wire-only inputs rejected for powder DED; laser-specific quantities not assigned to arc/EB |
| Unknown machine | Cannot state path feasible, even if generic bounding box fits |
| Frame transforms | Part loads preserve physical attachment across candidate rotations; substrate and head frames transform separately |
| Path times | Hand-calculated total distance / speed matches computed commanded time for a simple polyline (within numeric rounding) |
| Head clearance | Deliberate blocked nozzle segment rejected; unresolved kinematics correctly indicated |
| Geometry | Wrong units, inverted surfaces/invalid topology fail with actionable messages |
| Physical inputs | Missing units, negative bead width, zero speed, out-of-range overlap and nonfinite inputs rejected |
| Energy input | J/mm quantity computed only if applicable; no derived automatic porosity/strength acceptance |
| Thermal verification | Analytical transient heat checks, energy balance and spatial/time refinement pass predeclared tolerances |
| Structural verification | Force/moment equilibrium; independent reference and mesh refinement; isotropic frame invariance |
| DES | Deterministic one-server case and entity conservation match hand calculations; replications reproducible from seed |
| Unknown yield | No default numeric scrap probability or 'first print success' probability |
| Model reuse | Wrong material/process/heat-treatment/slicer data rejected with applicability reason |
| Artifact integrity | Project/report/Simio export all share same source geometry and candidate fingerprints |
| Race/failure | Stale asynchronous run cannot overwrite new orientation or process; cancellation and failure surfaced |
| Security | Unapproved external geometry uploads blocked; downloaded exports exclude prohibited/private data by default |
| UI regression | Beginner and experienced user can complete fresh example, understand evidence tiers and know next required action |

## 8. Implementation order revised for actual usability

**Milestone 0: machine/process questionnaire, evidence sources and demo selection**
- Ask project partners to identify: which DED process? machine/vendor and controller? feedstock? target alloy/condition? new-build or repair? nominal coupon/part? machine geometry and reach? available G-code/scan data? postprocessing and CTQs? actual Simio license/version? approved public/proprietary datasets? physical trial access?
- Do not block initial research prototype if unanswered: use public teaching wall, but label it illustrative and no machine-specific claim.

**Milestone 1: process-typed workflow / state**
- Add ProcessProfile and MachineProfile schemas, per-process forms, scenario hashes, migrations and tests. Keep original STL workflow and persistent service cases.
- Resolve duplicated /workspace, /orientation and /simulation user journeys and rename existing benchmark pages honestly.

**Milestone 2: DED first working capability**
- Geometry/substrate separation and browser path preview; track length, timing, nozzle envelope warning (when data available), bead footprint estimate and reproducible results.
- Add regression teaching cases for DED wire, powder and LPBF process switching.

**Milestone 3: Simio round trip**
- Export versioned data-table CSVs, build one licensed Simio route if team has access; otherwise implement an independent reference DES plus Import Results UX.
- Demo 2+ alternative deposition/finishing strategies with explicit scenario assumptions and seeded confidence intervals.

**Milestone 4: actual engineering physics**
- Surface-region selection -> verified conforming structural FEA -> verified transient thermal -> DED moving-source/layer activation -> process-specific calibrated distortion.
- Treat each solver as separate research capability until independent numerical/physical comparisons pass.

**Milestone 5: validation and decision package**
- Traceable property cards, quantitative engineering requirements, deterministic constraint-first comparison, useful reports, grouped/held-out ML only where matching labels, physically validated pilot with predeclared thresholds.

No calendar promise before machine/lab/license/data access audit. Completion must be evidence-defined, not based on arbitrary percent complete.

## 9. Decisions that block **claims**, not prototyping

| Decision | Why it matters | Safe fallback while unknown |
|---|---|---|
| Actual DED subtype vs LPBF | Entire manufacturing physics/constraints differ | teach process differences; generic geometry only |
| Make/model and head/robot kinematics | Path reach and collision, acceleration and timing | path visualizer only; no feasibility claim |
| Actual alloy, feedstock and heat treatment | Physics/properties and numerical margins | source-tagged illustrative values; no engineering suitability |
| Machine settings and validated envelope | Power/speed/feed calibration and quality predictions | user-entered assumed values, no "recommended" process parameter |
| Available process logs/temperatures/inspection | Thermal calibration, distortion, first-pass evidence | verified synthetic numerical benchmarks only |
| Simio version/license and facility time data | Actual discrete-event model and validated resource behavior | CSV schema + transparent reference DES |
| Data-use approval | Privacy/export-control restrictions | entirely public synthetic teaching examples |

## 10. Sources for the modeling choices

1. NIST, *Directed Energy Deposition*: https://www.nist.gov/additive-manufacturing/research-areas/technologies/directed-energy-deposition
2. NIST, *Additive Manufacturing Technologies*: https://www.nist.gov/additive-manufacturing/research-areas/technologies
3. NIST, *AM Bench 2025 Benchmarks*: https://www.nist.gov/ambench/am-bench-2025-measurements-and-challenge-problems
4. NIST, *AMB2025 short descriptions*: https://www.nist.gov/ambench/short-descriptions-2025-benchmarks
5. NIST, *AM Bench direct data links*: https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance (do not assume AMB2025-04/05 datasets are already linked)
6. Simio text, *Working with Model Data*: https://textbook.simio.com/SASMAA7/ch-data.html
7. Simio text, *Simulation-based Scheduling*: https://textbook.simio.com/SASMAA7/ch-scheduling.html

**Decision:** Build a bounded, functioning DED planning and simulation system with proper prerequisites, not a generic metal-printing angle optimizer that claims manufacturing viability without machine/process evidence.
