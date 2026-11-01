# ORIENTAI deterministic LPBF quality preflight — evidence contract (research prototype)

## What the feature can determine today

The **Automatic part risk preflight** measures real STL topology, configured build envelope, down-facing triangle normals, orientation-related proxy burden, and plate-contact proxy. Selected triangles can be highlighted. Geometric findings are source-hashed to the uploaded mesh, unit scale, orientation, screening threshold and study envelope. This does **not** verify supports, thin walls, thermal behavior or print success.

The **Process quality preflight** (added November 2026) compares four planned LPBF machine settings against **engineer-entered** numerical bounds:
- Laser power (W)
- Scan speed (mm/s)
- Hatch spacing (mm)
- Layer thickness (mm)

The source document ID/revision, machine, alloy/condition and process parameter-set identifier are entered by the engineer. A separate checkbox explicitly records their review; no fake defaults or undisclosed machine limits are applied. An out-of-range value is a **configuration blocker relative to those entered bounds**. A correct value in each independent interval is **not** a pass/fail quality prediction, because jointly qualified laser/scan/process windows and material-specific interactions must be checked.

For diagnostic comparison only, the program computes:
- Line energy \(P/v\), J/mm
- Areal energy \(P/(v h)\), J/mm²
- Volumetric energy-density proxy \(P/(v h t)\), J/mm³

These are not validated porosity, melt-pool stability, density, crack, fatigue or first-time quality predictors. No universal energy-density thresholds are shipped or fabricated. Results, evidence gaps and source context can be exported locally as JSON. On part/units changes, the input review is cleared.

## Failure mechanisms and present evidence

| Manufacturing mechanism | Current deterministic evidence | What is **not** established |
| --- | --- | --- |
| Open / inconsistent STL mesh | Source-derived topology edges and shells | Printability of repaired geometry, intersections absent |
| Machine-envelope overflow | Rotated mesh bounding box vs configured dimensions | Recoater motion clearance or actual machine fit outside user-entered configuration |
| Elevated down-facing area | Source triangle orientation and height | Sufficient support design, distortion or likely fracture |
| Potential new physical-layer islands | Sampled slices with no previous-layer XY overlap (separately approved slicer) | Support connectivity or reliable thin-wall detection below raster pitch |
| Planned process parameters outside bounds | Numeric comparisons with **reviewed user-supplied** limits | Actual porosity, cracking, failure event, repeatability |
| High or low energy-density proxy | P/(vht) arithmetic | Lack-of-fusion or keyhole classification |
| Service-load structural response | Separately approved idealized elastic FEM | Residual stress, anisotropic fatigue or accepted aerospace loads |
| Process heating | Separately approved experimental coarse heat-flow models | Verified real scan thermophysics, melt-pool dimensions, distortion or certification |

## Mandatory path toward real predictive first-time quality

1. Obtain approved, non-restricted machine/material/parameter data, powder and inspection acceptance definitions. Do not upload controlled Boeing data to public services.
2. Build a design of experiments using known scan strategies, geometry, power, speed, hatch and layer settings, powder lot, platform conditions, atmosphere, orientation, supports and post-process steps.
3. Record outcome labels from actual builds: XCT porosity, density, dimensional/metrology deviation, surface finish, cracks, distortion, recoater faults and mechanical fatigue where needed. Preserve test method, uncertainty and provenance.
4. Correlate numerical thermal histories to NIST AM Bench or equivalent measurements **for the same material, process and observable**, including calibration and spatial/temporal registration.
5. Establish mechanism-specific acceptance limits **before** testing. Validate models on held-out builds or machine/time/material lots, quantify false negatives, calibration, uncertainty and out-of-distribution coverage.
6. Only when the specified prediction method and experimental evidence are available should the UI expose a mechanism-specific forecast with calibrated uncertainty and validation scope. Until then display **Not assessed**, not 0% risk.

## References and model cautions

- NIST AM Bench, real benchmark measurements for LPBF simulations: https://www.nist.gov/ambench
- NIST (2025), *Toward The Realtime Feedback Control for Powder Bed Fusion Additive Manufacturing*: https://www.nist.gov/publications/toward-realtime-feedback-control-powder-bed-fusion-additive-manufacturing
- NIST publication, *Instrumented micro/macroindentation of porosity defects in laser powder bed fusion 316L stainless steel*, describes under- and over-energy porosity mechanisms: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=958585

The research code and reference material are informational. They are not qualification or certification procedures. The engineer is responsible for confirming all inputs and decisions.
