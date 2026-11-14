# ORIENTAI LPBF failure-risk validation protocol

## Current supported system
1. Upload real STL, verify units and inspect mesh topology.
2. Run deterministic geometry/orientation and engineer-provided parameter-window checks.
3. Inspect actual sampled physical STL layer geometry and optional registered scan path; verify resolution and bounds before treating any numerical result as a physical approximation.
4. Treat available thermal and service-mechanics calculations as research models until independently verified in the named process/material envelope.
5. Review measured defect evidence at `/defect-evidence`. This is a *validation calculator*, not a predictor.

## Two deliberately separate initial targets
- **Lack of fusion:** Define an observed class from approved cross-section, CT/relative-density or other independent measurement with a predeclared inspection threshold. Use machine/material/scan settings and validated melt-pool overlap or depth predictions as candidate features; do not use volumetric energy density alone to claim failure.
- **Distortion:** Use actual post-build metrology in millimeters and an independent transient thermal/mechanical model. Continuous displacement must be evaluated using residual error, MAE/RMSE and spatial pattern comparisons, not the binary defect calculator until an inspection tolerance is explicitly defined.

## Data contract for binary defect evaluation
The JSON accepted by `app/defect-evidence/page.tsx` is documented by `DefectValidationInput` in `lib/lpbf-defect-validation.ts`. Each row requires unique inspection ID, independently assigned `buildId`, observed binary defect, and `predictedProbability` in [0,1] (or null for abstention).
Do **not** use the five synthetic demonstration rows as real validation, build qualification, training labels, or an estimate of actual model performance.

## Mandatory research gates before prediction claims
- Select **one** metal alloy condition and **one** LPBF machine/process revision.
- Identify measurement provenance, inspection threshold and independent reference.
- Partition by complete **build**, not randomly by layer, scan pixel or coupon from the same build.
- Separate training, validation and untouched held-out test builds; freeze model, preprocessing, threshold and outcomes before the final evaluation.
- Report sample counts and independent build IDs, prevalence, abstention coverage, confusion matrix, precision, recall, specificity and Brier score. Include uncertainty intervals and calibration assessment before any deployment claim.
- Compare against a conservative baseline; evaluate robustness on changes in material lot, machine state, geometry and parameter set. Abstain on unsupported material/machine configurations.
- Never translate geometric support proxies or unvalidated physical fields into a calibrated defect probability.
- No probability should be displayed in the primary pre-build report until this evidence gate is satisfied and a model has an explicit supported scope.

## Public measurement starting points (not a fitted model)
NIST AM Bench provides independent measurements and reference challenges, including LPBF melt-pool geometry and temperature/time histories.
- https://www.nist.gov/ambench
- https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance
- https://www.nist.gov/ambench/am-bench-2025-measurements-and-challenge-problems

**Important:** AM Bench reference measurements do not imply that a transferable full-part failure-label training set exists. Check the exact challenge, experimental modality, alloy and process before using data.

## Completion limits
The initial release is explainable **pre-build screening**, not certified build approval or industrial reliability assessment. Full thermal defect models, qualified process limits, statistical predictor training, experimental build comparisons and quantitative reductions in first-time-print failure remain separate milestones.
