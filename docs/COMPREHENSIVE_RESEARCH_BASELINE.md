# Comprehensive Research Baseline — Aerospace Metal AM First-Time Quality

**Research baseline:** 2026-10-01  
**Purpose:** Technical foundation for the Virginia Tech senior-design AM First-Time Quality platform. This document is a public-source engineering research baseline, not a Boeing process specification.

## 1. Core conclusion
The correct system is an end-to-end, evidence-based metal additive manufacturing digital thread. “First-time quality” cannot be reduced to CAD optimization or a generic AI parameter recommender. The software must connect design intent and critical-to-quality (CTQ) requirements to geometry, material/feedstock, machine capability/state, build preparation, process parameters, process signatures, post-processing, inspection, and actual performance evidence.

The target is **first-part-correct / born-qualified decision support**: reduce physical iteration by using validated rules, measurements, simulations, data-driven models and prior build evidence before committing to a build, while retaining explicit engineering approval gates.

## 2. Boeing relevance
Public Boeing material establishes several relevant themes:
- Boeing’s Auburn Additive Manufacturing Fabrication Center was established to develop repeatable, stable and reliable AM processes and meet certification/qualification needs; public information identifies aluminum and titanium metal powder-bed capability.
- Boeing publicly describes enterprise AM in terms of qualified materials, a common digital thread, performance, rate, cost and repeatability.
- Boeing Defense Air Dominance digital-engineering work publicly links model-based engineering, PLM, additive manufacturing and cross-discipline collaboration.
- Boeing rapid-prototyping examples demonstrate the value of 3D scanning, digital capture, printing, fit checks and rapid design iteration before fleet implementation.

**Software implication:** optimize the digital engineering loop and evidence flow, not only the printer file.

## 3. Product lifecycle model
### A. Requirements and risk
Capture function, interfaces, loads, environments, dimensional/GD&T requirements, surfaces, mass, material constraints, CTQs, inspection requirements, consequence of failure and maturity state. Use a risk/criticality classification to determine required rigor.

Suggested workflow maturity states:
1. Concept
2. Engineering prototype
3. Process-development article
4. Qualification candidate
5. Controlled production

Higher maturity requires progressively stronger evidence and locked configurations.

### B. CAD and model-based definition
Maintain native/parametric geometry whenever possible. Preserve design intent, units, coordinate system, features, PMI/GD&T, revision, rationale and requirement links. STL is useful for tessellated geometry but should not be the authoritative engineering definition for a mature aerospace workflow. Support STEP/STEP AP242 and richer AM interchange formats as the system matures.

AI-assisted CAD should work through constrained feature/parameter generation:
- convert requirements into a structured design brief;
- propose feature trees/parameters;
- generate multiple feasible candidates inside a defined design space;
- run constraint and manufacturability checks;
- use topology/generative optimization only with explicit load cases, preserve regions, interfaces, minimum features and manufacturing constraints;
- require deterministic CAD regeneration and geometry validation.

### C. DfAM geometry analysis
Analyze at minimum:
- manifold/watertight mesh state and normals;
- dimensions, volume, surface area, center of mass;
- minimum wall/strut/pin/hole/channel features;
- overhang/downskin/upskin regions;
- enclosed volumes and powder-removal access;
- support accessibility/removability;
- critical surface accessibility for machining/inspection;
- recoater collision/protrusion risk;
- build-envelope fit;
- thermal mass transitions and heat-conduction changes;
- thin features and distortion-prone regions;
- internal-channel inspectability;
- machining stock and datum strategy.

Do not encode universal geometric limits as facts. Limits must be tied to material + process + machine + qualified evidence.

### D. Orientation optimization
Orientation is a multi-objective problem. Candidate orientations should be scored against:
- support volume/contact area;
- build height and estimated time;
- critical surface orientation;
- mechanical-property directionality;
- distortion/residual-stress risk;
- thermal behavior;
- powder evacuation;
- recoater risk;
- support removal/post-processing access;
- inspection accessibility;
- build-plate utilization and cost.

Return a Pareto set rather than pretending one orientation is universally optimal.

### E. Support planning
Supports in metal PBF are not merely geometric scaffolds. They affect anchoring, heat flow, residual stress/distortion, surface condition and post-processing. Model support regions, type, density/interface, removal access, critical-surface conflicts and predicted thermal/mechanical consequences. Preserve supports as versioned manufacturing data.

## 4. Feedstock/material system
For powder processes track material specification and lot pedigree, supplier, virgin/reused/blend state, reuse history, particle-size distribution, morphology, apparent/tap density where applicable, flow/spreadability, chemistry/interstitials, moisture/contamination evidence, sampling/testing method, storage/handling state and acceptance status.

Why: powder size, morphology, chemistry and spreading behavior can affect powder-bed behavior and part outcomes. Titanium is especially sensitive to interstitial contamination/oxygen.

Initial material families for research:
- Ti-6Al-4V / Ti-6Al-4V ELI
- Inconel 718 and other nickel superalloys
- aluminum alloys such as AlSi10Mg where relevant
- stainless steels for lower-cost workflow development

Each material profile must separate handbook/reference knowledge from organization-qualified machine/material/process data.

## 5. Machine qualification and configuration
A machine profile is a controlled configuration, not just a printer name. Track:
- manufacturer/model/serial;
- build envelope;
- laser/e-beam architecture and relevant optical/electrical configuration;
- recoater type;
- atmosphere/vacuum system;
- build plate/substrate;
- firmware/control/software/build-prep versions;
- calibration/maintenance status;
- sensor/monitoring capabilities;
- installation/operational/performance qualification evidence;
- material/process qualifications and permitted parameter envelopes;
- configuration changes and effective dates.

No machine-specific build file should be released if required configuration evidence is missing or stale.

## 6. Process-parameter knowledge
For LPBF the data model should be able to represent, where exposed by the machine/vendor workflow:
- laser power;
- scan speed;
- hatch spacing;
- layer thickness;
- spot/beam characteristics;
- scan strategy/vector ordering/island/stripe strategy;
- contour/downskin/upskin parameters;
- preheat/build-plate temperature;
- atmosphere/oxygen state;
- recoating variables;
- dwell/inter-layer timing;
- support parameters.

Avoid relying on a single volumetric-energy-density number as a sufficient description of process quality. The physical result depends on coupled parameters, geometry, thermal history, material and machine.

Parameter optimization must remain inside a validated/approved search domain unless the workflow is explicitly a controlled experiment.

## 7. Process physics and failure modes
The knowledge graph should connect process inputs to process signatures, defects, microstructure, properties and final CTQ outcomes.

Important phenomena/risks include:
- insufficient fusion / lack-of-fusion porosity;
- keyhole-mode instability and keyhole porosity;
- entrapped-gas porosity;
- balling/spatter;
- cracking/hot cracking depending on alloy;
- residual stress and distortion;
- delamination/layer defects;
- rough surfaces, especially overhang/downskin behavior;
- powder-spreading/recoating anomalies;
- geometry-dependent thermal accumulation;
- anisotropy/texture and location/orientation dependence;
- dimensional deviation;
- support failure and recoater interaction.

The system should distinguish **anomaly**, **flaw**, **defect**, and **acceptance failure**. A measured anomaly is not automatically a rejectable defect; acceptance depends on requirements and validated limits.

## 8. Simulation and digital twins
Use multiple fidelity levels:
1. Fast analytical/geometric screening for every iteration.
2. Reduced-order/surrogate thermal/distortion predictions for rapid optimization.
3. Higher-fidelity thermo-mechanical/microstructure simulation for selected candidates.
4. Experimental/build data for calibration and validation.

Models must carry version, training/calibration data scope, assumptions, validation evidence, applicable material/machine/domain, uncertainty and out-of-domain status.

NIST AM Bench is a valuable public source for benchmarking simulation/modeling methods against controlled measurements.

## 9. AI architecture
Do not use one monolithic “AI optimizer.”

### Knowledge/requirements AI
LLM + retrieval over approved public/internal standards, specifications, lessons learned and machine documentation. Functions: requirement extraction, standards navigation, engineering rationale drafting, checklist generation. It must cite evidence and never silently convert narrative guidance into qualified limits.

### Geometry AI
Feature recognition, manufacturability classification, candidate feature modification and constrained generative design. Deterministic geometry checks remain authoritative for geometric facts.

### Optimization AI
Multi-objective optimization/Bayesian optimization/DOE for orientation, supports and process-development experiments. Objective functions can include quality risk, dimensional error, porosity proxy, support/material, time and cost.

### Physics-informed/surrogate models
Approximate expensive thermal, distortion or microstructure models after validation. Use uncertainty quantification.

### Monitoring AI
Computer vision/time-series/spatiotemporal models for layer imagery, powder-bed imagery, melt-pool/thermal signals and machine logs. Register anomalies back to part coordinates/layers/features.

### Quality prediction
Fuse geometry, feedstock, machine, parameter, sensor, post-process and inspection data to predict CTQ outcomes. Use calibrated probabilities/intervals, not unqualified pass/fail confidence.

### Learning loop
Actual inspection results become labels/outcomes. Models are retrained/evaluated under controlled dataset/model versioning. No automatic model promotion to production.

## 10. In-situ monitoring
Potential data sources include:
- coaxial melt-pool imagery/photodiodes;
- high-speed visible/IR imaging;
- layer-wise powder/solid-layer images;
- machine telemetry;
- atmosphere/oxygen data;
- recoater events;
- laser position/power commands;
- acoustic/other sensors where available.

Required functions:
- timestamp synchronization;
- coordinate registration to scan vectors/layers/part geometry;
- sensor calibration metadata;
- anomaly detection;
- spatiotemporal analysis rather than isolated pixel/event classification;
- evidence visualization on the 3D part;
- traceable relationship to post-build inspection.

Closed-loop control is an advanced stage and should only be implemented on a machine/testbed that explicitly supports validated real-time control.

## 11. Post-processing
Treat post-processing as part of the controlled manufacturing route:
- depowdering;
- support removal;
- stress relief;
- HIP where specified;
- solution/aging/other heat treatment;
- build-plate separation;
- machining/reaming/grinding/EDM;
- surface finishing/shot peening/polishing as applicable;
- cleaning;
- coatings or other finishing.

Record furnace/equipment identity, recipe/version, actual cycle data, deviations and resulting material condition. Final properties cannot be predicted solely from as-built process settings.

## 12. Inspection, NDE and acceptance
Create an inspection plan directly from CTQs and identified AM risks. Potential evidence:
- dimensional CMM/optical/structured-light measurements;
- surface texture/topography;
- X-ray CT for internal geometry/porosity where technically capable;
- radiography/ultrasonic or other NDE as applicable;
- density/porosity measurements;
- metallography on witnesses/coupons;
- tensile/fatigue/fracture/hardness testing as required;
- chemistry/microstructure testing;
- proof/load/leak/functional tests as applicable.

Inspection capability itself depends on geometry and resolution. Store method capability/uncertainty and acceptance criteria, not merely a “CT passed” flag.

## 13. Qualification architecture
Qualification is layered:
- facility/QMS/control plan;
- personnel/operator qualification;
- feedstock/material qualification;
- equipment IQ/OQ/PQ and calibration/maintenance;
- process/material specification and locked process controls;
- material property database/allowables where applicable;
- part-specific production plan;
- preproduction/qualification/first-article evidence;
- production monitoring and witness specimens/coupons;
- inspection/NDE and acceptance;
- configuration/change control and requalification impact assessment.

A process change must trigger an impact assessment rather than silently propagating through the workflow.

## 14. Data architecture / digital thread
Use a relational/graph-aware model aligned where practical to the ASTM F3490 common data dictionary concepts and NIST common data-model work.

Core entities:
- Program/Project
- Part / Part Revision
- Requirement / CTQ
- CAD Model / PMI
- Geometry Revision
- Material Specification
- Feedstock Lot
- Machine / Machine Configuration
- Facility
- Operator
- Build Plan
- Orientation
- Support Plan
- Parameter Set / Qualified Envelope
- Build / Layer / Scan region
- Sensor / Calibration
- In-situ Observation / Anomaly
- Post-process Route / Operation
- Specimen/Witness Coupon
- Inspection Plan
- Measurement / NDE Result
- Nonconformance / Disposition
- Simulation Run
- AI/ML Model Version
- Recommendation
- Approval
- Build Package / Artifact

Every important object receives a persistent ID, revision, creator/source, timestamp, provenance, status and cryptographic hash where applicable.

## 15. Build package / evidence package
Generate a reproducible manifest containing:
- authoritative part/revision and geometry hashes;
- requirements/CTQs;
- material/feedstock lot;
- machine/configuration/calibration state;
- orientation/support plan;
- parameter-set ID and qualification basis;
- build-prep software/version;
- generated machine artifact hash;
- simulations and model versions;
- risk assessment;
- approvals;
- required witnesses/coupons;
- inspection plan;
- post-processing route;
- actual build telemetry references;
- final inspection results and disposition.

This package becomes the core “digital birth record” for each build/part.

## 16. Security
Metal AM is cyber-physical manufacturing. Required controls for a serious system include:
- private authenticated storage;
- least-privilege RBAC;
- environment-secret management;
- encryption in transit/at rest;
- hashes/signatures and tamper detection;
- immutable audit trail;
- separation of development/test/controlled configurations;
- machine interface allowlists;
- no arbitrary AI-generated commands sent to machines;
- backup/retention policy;
- export-controlled/proprietary-data handling according to sponsor/program requirements.

A public Vercel deployment is appropriate only for sanitized senior-design demonstrations, not controlled Boeing technical data unless explicitly approved and configured for the required environment.

## 17. Environment, health and safety
Metal powder processes require formal facility procedures. Software can track prerequisites and evidence but must not replace machine/facility controls. Track SDS, powder hazard classification, required PPE/process procedures, atmosphere/inert-gas state where available, waste disposition, training and incident/deviation records. Powder inhalation/dermal exposure, fire/explosion, lasers, hot surfaces, mechanical hazards and inert-gas/asphyxiation concerns must be addressed by approved procedures.

## 18. Standards/reference map
Publicly relevant standards/guidance to track include, depending on application:
- FAA AC 33.15-3 — PBF AM for aircraft engine parts.
- NASA-STD-6030 — AM requirements for spaceflight systems.
- NASA-STD-6033 — AM equipment/facility control.
- ISO/ASTM 52900 — AM vocabulary.
- ISO/ASTM 52904 — metal PBF for critical applications.
- ISO/ASTM 52907 / ASTM F3049 — metallic powder/feedstock characterization.
- ISO/ASTM 52908 — post-processing/inspection/testing of PBF parts.
- ISO/ASTM 52909 — orientation/location dependence of metal PBF properties.
- ISO/ASTM 52920 — industrial AM process/production-site qualification principles.
- ISO/ASTM 52930 — PBF-LB equipment IQ/OQ/PQ.
- ISO/ASTM 52931 — metallic AM EHS.
- ISO/ASTM 52942 — aerospace PBF-LB operator qualification.
- ISO/ASTM 52950 — AM data-processing overview.
- ASTM F2924 — PBF Ti-6Al-4V.
- ASTM F3055 — PBF Alloy 718.
- ASTM F3122 — evaluation/reporting considerations for mechanical properties.
- ASTM F3490 — AM common data dictionary/data pedigree.
- ASTM F2971 — reporting AM specimen/material/process data.
- SAE AMS7003A — aerospace L-PBF process controls.
- SAE AMS7028 — L-PBF + HIP Ti-6Al-4V material specification.

Do not claim compliance solely because software implements a checklist. Compliance depends on applicable program requirements, controlled procedures and objective evidence.

## 19. What “first-time quality” should optimize
A multi-objective formulation should eventually consider:
- probability of meeting each CTQ;
- probability/severity of defects;
- dimensional error/distortion;
- material/property risk;
- support burden and removal risk;
- surface/finish burden;
- build time;
- material usage;
- post-processing time;
- inspection feasibility/cost;
- total prototype lead time;
- total cost;
- uncertainty and evidence strength.

The system should show tradeoffs/Pareto candidates rather than hide them behind one opaque score.

## 20. Implementation priority for the senior-design prototype
### Tier 1 — must work
1. Requirement/CTQ capture.
2. Parametric CAD generation + STEP-capable CAD service.
3. STL/STEP geometry ingestion and 3D viewer.
4. Real geometry metrics and DfAM risk maps.
5. Orientation candidate generation/scoring.
6. Material/feedstock and machine-profile schema.
7. Traceable recommendation engine.
8. Build manifest/evidence package.
9. Inspection-plan generator.
10. Revision/provenance/audit model.

### Tier 2 — high-value demonstration
11. Support-region prediction.
12. Fast distortion/thermal surrogate interface.
13. DOE/build-history import.
14. Bayesian/multi-objective optimization constrained to experimental parameter ranges.
15. Predicted-vs-actual quality dashboard.
16. NIST AM Bench dataset experiment/model-validation demonstration.

### Tier 3 — depends on lab hardware
17. Exact printer adapter.
18. Native build-prep/control-file export.
19. Machine telemetry ingestion.
20. Layer/melt-pool monitoring.
21. Closed-loop/adaptive control research mode.

## 21. Required lab facts before printer integration
Obtain and record:
- exact printer manufacturer/model/serial;
- process type (LPBF/EB-PBF/DED/etc.);
- controller/board/firmware/software versions;
- build-prep/slicer software and version;
- supported import/export/build-job formats;
- API/SDK/OPC UA/MTConnect/file-drop capabilities if any;
- materials currently approved/available;
- parameter-edit permissions and qualified ranges;
- sensor/monitoring channels and export formats;
- build volume/recoater/build-plate details;
- lab safety/operating restrictions;
- what files/data the sponsor permits the team to store or transmit.

## 22. Research validation strategy
Use three levels of validation:
1. **Software validation:** unit tests, geometry truth cases, schema validation, deterministic regeneration, security checks.
2. **Model validation:** compare simulations/ML against held-out experimental data and public benchmarks such as NIST AM Bench; report error and uncertainty.
3. **Physical validation:** print controlled test artifacts/coupons, measure geometry/defects/properties, compare predicted vs actual, and iterate.

The senior-design success metric should be demonstrable reduction in failed iterations or improved prediction of whether a candidate will satisfy predefined CTQs—not a claim of aerospace certification.

## 23. Source families used for this baseline
Primary/public sources reviewed include Boeing public AM/digital-engineering materials; FAA AC 33.15-3; NASA-STD-6030 and NASA-STD-6033; NIST Measurement Science for AM, Fundamental Measurements for Metal AM, AI2AM, AM Bench, digital-thread/data-model/security research; ASTM/ISO AM standards catalog and scopes; SAE aerospace AM specifications; and NIOSH metal-AM safety guidance.

This research baseline should be revised whenever the sponsor supplies actual machine, material, program, process or qualification requirements.
