# Boeing VT AM — Target Problem Definition

## Primary objective
Develop and demonstrate an AI-assisted design-to-build workflow for a thin-walled, load-bearing metallic aerospace structure. The system should reduce structural mass/material while maintaining required structural performance and improving additive-manufacturing readiness and first-time-quality evidence.

## Current controlled surrogate
Until Boeing confirms/provides the exact target component and approved data, the canonical research article is a small semi-monocoque fuselage-style section:
- load-carrying thin skin
- circumferential frames
- longitudinal stringers
- pressure, axial, bending and torsional loading
- aluminum/titanium research profiles
- sized for eventual VT metal-AM build and physical test

This is a research surrogate, not a Boeing production geometry and not a claim that Boeing selected a fuselage.

## Core optimization statement
Minimize mass/material volume subject to:
- strength screening / approved allowables when supplied
- stiffness / displacement limits
- local and global buckling constraints
- preserved interfaces and design envelope
- fatigue/dynamic constraints when available
- minimum manufacturable features
- build orientation/support/access constraints
- thermal/distortion/process constraints
- inspection and post-processing access

## Required end-to-end demonstration
Baseline CAD → define loads/BCs → structural analysis → identify load paths → optimize skin/stiffening → re-analyze → AM manufacturability/process optimization → compare alternatives → engineer review → generate build package → metal print → inspect/load test → compare prediction to experiment → update models.

## Product scope
### Primary
The Boeing target thin-wall structural problem and controlled surrogate.

### Secondary/extensible
Approved engineer-uploaded CAD/mesh geometry. Generic import is useful infrastructure but is not the senior-design research objective by itself and must not claim arbitrary-part FEA/optimization before the relevant geometry and solver capabilities exist.

## Engineering truth rules
- Do not infer boundary conditions or loads from geometry alone.
- Do not call screening calculations certified FEA.
- Do not label a part flight-ready or manufacturing-qualified from heuristic scores.
- Do not invent aerospace allowables or qualified machine parameters.
- Record assumptions, data provenance, model/rule version and validation state.
- Machine-facing output remains gated until exact machine/material/process data and lab authorization are available.

## Confirmation needed from Boeing
1. Exact target component/geometry and whether a sanitized model can be shared.
2. Required load cases and boundary conditions.
3. Material and approved/reference allowables.
4. Critical dimensions/interfaces and displacement constraints.
5. Buckling, fatigue, dynamic and damage-tolerance requirements.
6. Intended AM machine, process and material state.
7. Qualified manufacturing limits/process window that may be used.
8. Required inspection/acceptance criteria.
9. Permitted data environment and export-control/proprietary-data handling.
10. Physical test method and success criteria for the senior-design demonstrator.
