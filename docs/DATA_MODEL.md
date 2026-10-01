# First-Time Quality Data Model

This schema is the implementation target for the AM digital thread. Each record includes id, revision/version where applicable, createdAt, source/provenance, status, and integrity metadata.

| Domain | Core records | Key relationships |
|---|---|---|
| Engineering | Project, Part, PartRevision, Requirement, CTQ, Approval | PartRevision satisfies Requirements; CTQ maps to analysis + inspection |
| Geometry | CADArtifact, MeshArtifact, Feature, PMI, Orientation, SupportPlan | Artifacts belong to revision; orientation/support derive from geometry hash |
| Materials | MaterialSpec, FeedstockLot, PowderMeasurement, MaterialCondition | Build consumes lot; lot evidence maps to spec/acceptance |
| Equipment | Facility, Machine, MachineConfiguration, Calibration, Maintenance, Sensor | Build locks machine configuration and calibration state |
| Process | ProcessSpec, QualifiedEnvelope, ParameterSet, BuildPlan, ScanStrategy | Parameter set must be inside approved envelope or marked experimental |
| Build | Build, Layer, Region, MachineArtifact, WitnessSpecimen | Build binds part/material/machine/process configuration |
| Monitoring | SensorStream, Observation, Anomaly, Registration | Observation registered to time/layer/part coordinate/feature |
| Post-process | Route, Operation, EquipmentRun, MaterialCondition | Operations transform as-built condition to final condition |
| Quality | InspectionPlan, Measurement, NDEResult, TestResult, Nonconformance, Disposition | Results verify CTQs and acceptance criteria |
| Modeling | SimulationRun, Dataset, MLModel, Prediction, Recommendation | Every prediction retains model/data/domain/uncertainty lineage |
| Evidence | BuildManifest, ArtifactHash, AuditEvent, Signature | Immutable evidence package reconstructs the complete build |

## Mandatory gating concepts
- maturityState: concept | prototype | process-development | qualification-candidate | controlled-production
- configurationStatus: draft | validated | qualified | expired | superseded
- recommendationStatus: proposed | reviewed | accepted | rejected | implemented
- evidenceStrength: reference | simulated | experimentally-supported | qualified
- domainStatus: in-domain | extrapolation | unknown
- releaseStatus: blocked | engineering-review | approved-for-experiment | approved-for-build

## Non-negotiable lineage
A prediction/recommendation must point to the exact part revision/geometry hash, material/feedstock context, machine configuration, process domain, model version, inputs, timestamp, uncertainty/confidence method, and supporting evidence. A build must point to the exact approved artifacts it used. Inspection results must point back to CTQs and the physical build/part/specimen they measured.
