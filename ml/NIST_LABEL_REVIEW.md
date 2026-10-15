# NIST MaTTO ingestion and training gate

**Source**: NIST AM Bench 2022, dataset mds2-2588 (IN625, LPBF), https://doi.org/10.18434/mds2-2588.

## Verified from dataset catalog
- NIST reports 96 tensile specimens extracted from IN625 blocks with XY and X-only scan strategies.
- Specimen tensile axes span several orientations with respect to the build direction.
- Measurements are tensile behavior, **not** per-orientation slicer-generated support volume.

## Reproducible processing workflow
1. Run GitHub Actions **Audit public NIST material data**. Inspect the uploaded JSON provenance inventory, download errors, and source archive checksums.
2. Inspect every archived data sheet/column, specimen identifier, units, scan strategy and *tensile-axis versus build-direction* angle definition.
3. Review the source README and map only explicit measured specimen rows to `study_id,specimen_id,material,process_profile_id,build_angle_deg,yield_strength_mpa`.
4. Validate specimen count, orientations, specimen IDs, missing data, units, source citation and NIST license. Never invent labels or treat original challenge predictions as measured values.
5. Run `python ml/train_material_orientation.py --csv reviewed.csv` **only after** data normalization and provenance review. That trainer requires at least **three independent studies**, not just three scan-strategy groups from one study.
6. If only MaTTO data are available, report single-study exploratory descriptive statistics; do not assert cross-study predictive validation or model release.
7. Upload a versioned provenance record and holdout metrics to the research report only after the workflow has actually run.

## Data target separation
Support-volume surrogate requires directly matched part STL, orientation, slicer/process profile, and true slicer-reported support volume. None of the MaTTO tensile measurements can act as support labels. The current ML page remains NOT TRAINED until those process-matched labels exist.

## Reliability
Data retrieval success, a passing automated build, or low regression error does not establish material allowables, aerospace approval, or first-time-quality prediction. Require independent external validation and engineering review.
