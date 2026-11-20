# ORIENTAI M04 benchmark integration — November 20, 2026

This is an engineering verification fixture set, NOT a Boeing design, print setup, or qualified manufacturing process. The new generator produces four deterministic, closed binary STL files in browser memory and tests. Files are not downloaded from an external service.

## Representative parts

| Part | Reference volume (mm³) | Original build height | Height after X=90° |
| --- | ---: | ---: | ---: |
| 20 mm calibration cube | 8000 | 20 mm | 20 mm |
| Faceted thin-wall sleeve, inner R10 and outer R12, 32 mm tall | 4421.586 | 32 mm | 24 mm |
| L-bracket | 5310 | 34 mm | 18 mm |
| Bridge, 28 mm elevated roof span | 7680 | 24 mm | 15 mm |

The baseline bridge has 420 mm² of elevated downward-facing roof (28 × 15), distinct from 180 mm² of plate-contacting bottom faces. No actual metal supports have been generated.

## Existing engineering code reused

- lib/stl-mesh-audit.ts verifies STL topology and volume.
- lib/orientation-engine.ts evaluates geometry-only orientation candidates and proxy metrics.
- lib/lpbf-physical-slicer.ts generates bounded, source-hashed, four-ray XY sampled occupancy per physical Z layer.
- components/v2/PhysicalSliceWorkspace.tsx provides engineer-approved slice inspection and registration.

The new controls in components/v2/ChatLanding.tsx load each fixture into the existing study. They reset STL unit conversion to 1 mm/unit and select the uploaded LPBF workflow. The engineer must explicitly confirm dimensions before any analysis. They do not run a physics simulation or contact an external AI service.

## Preregistered geometric software targets

- Four meshes: closed, consistently oriented, one connected shell, deterministic bytes; polygonal volume difference at most 0.001%.
- At verification pitch 1 mm and physical layer height 1 mm: sampled cube and prism volume difference no more than 1%; sampled annular sleeve difference below 2%.
- Reference physical layer counts in original orientations: cube 20, sleeve 32, bracket 34, bridge 24; in X90 orientations: sleeve 24, bracket 18, bridge 15.
- Source SHA-256 remains constant after orientation, and the hollow sleeve center is never filled.
- Test the original bridge against the independent 420 mm² elevated roof check after subtracting plate-contacting bottom area.
- Result status must remain SAMPLED_GEOMETRY_REVIEW_REQUIRED.

## Independent study versus live engine

The previous standalone study evaluated 54 fixed angle combinations at 0.05 mm layer height. The application's default orientation engine uses 24 orthogonal candidates plus optional low-discrepancy rotations; it also counts plate-contacting downward faces. Compare only when angle definitions and metrics are aligned.

The physical slicer is sampled, not an exact polygon contour slicer. It can miss thin walls, cavities or topology at coarse XY resolution. Its output does not establish thermal fields, real supports, porosity, cracks, distortion, safety, build feasibility or first-time quality. M05-M07 and experiment-based validation remain separate work.

## Developer verification

Run npm ci, npm test, npm run typecheck, npm run build, and npm run test:e2e on a checked-out branch, then inspect exact GitHub CI head SHA. Do not merge failed checks or claim a Vercel deployment is current without verifying its commit SHA.
