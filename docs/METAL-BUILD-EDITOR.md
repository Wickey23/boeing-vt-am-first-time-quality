# ORIENTAI metal build-frame model editing: implemented M06 integration

## Scope

- Entry: main ChatGPT-style `/copilot` after STL upload and process `PBF_LB_METAL`; expand **Physical STL layers & scan-to-part preflight**, then **Prepare part for metal build**.
- Rigid transformations are processed **locally** by `workers/metal-build-edit.worker.ts`, using `lib/metal-build-edit.ts` and the original verified STL bytes. No ARC call and no in-place change to source.
- Confirm STL units and dimensions, then confirm the actual machine envelope (default UI values are examples, not presets).
- Enter X/Y/Z XYZ-Euler rotations in degrees and translations in millimeters, or inspect geometry-only suggestions.
- **Inspect model placement**: calculates transformed bounds, volume proxy, source triangle count, open/nonmanifold flags, envelope interference and build-height-only orientation proposals.
- **Apply geometry**: sets the shared transform in the physical-layer slicing workspace; invalidates previous physical slices, registration, machine assumptions and user approval.
- **Export edited STL (mm)**: available only after approved inspection of a closed source mesh within the configured envelope; writes a separate ASCII STL with transformed vertices and output SHA-256. Original STL remains unchanged. Re-upload the edited STL to display its baked geometry in the main 3D viewer.

## What this is not

- No vertex/face editing, holes, lattice/infill, supports, Boolean cutting or CAD healing.
- The view of the original uploaded STL does not visually rotate when a pending edit recipe is entered. A new exported/re-uploaded STL is the actual changed geometric object.
- Inside a 3-axis build envelope does **not** demonstrate printable supports, recoater clearance, fatigue performance, low porosity, thermal stability, mechanical quality or first-time quality.
- Source document coordinate frames, approved load locations, thermal fields and any uploaded scan paths do **not** transform automatically. An engineer must re-register inputs to the edited part.
- Only a model explicitly validated with machine/material data and experimental evidence can assess print defect probability.

## Evidence

- `tests/metal-build-edit.test.ts`: unit-scale, mesh hash, closed-mesh gating, rigid coordinate transform, independent STL export and numerical suggested orientations.
- `tests/browser/metal-build-edit.spec.ts`: user approvals, worker-based inspection, suggested plate placement, shared physical-slicer recipe and exported file bytes.
- `tests/browser/arc-main-chat.spec.ts`: external model consent, error provenance and no automatic cross-service access.

## Follow-on milestones

A) Preview edited geometry live **as a distinct overlay** without overwriting uploaded source or mislabeling original mesh.

B) Cross-check edited build frame against a user-chosen, source-documented actual machine envelope and part/assembly interfaces.

C) Rerun and compare physical-layer area, contour proxies and separately approved thermal/structural studies under each orientation.

D) Only then evaluate evidence-calibrated defect metrics, with uncertainty, benchmark trace registration and quality gates.
