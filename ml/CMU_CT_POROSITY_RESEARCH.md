# CMU Ti-6Al-4V CT porosity source audit (research only)

Primary public source: Justin Miner and Sneha Prabha Narra (2024), *Dataset of X-ray Micro Computed Tomography Porosity Measurements from Powder Bed Fusion – Laser Beam Ti-6Al-4V*, https://doi.org/10.1184/R1/26304175.v1, CC BY 4.0.

**Why this source:** EOS M290 Ti-6Al-4V physical coupons with processing conditions and individually measured CT pore descriptors are more directly relevant to manufacturing-quality modeling than image appearance classifications.

**Verified by the initial source-file audit:** Figshare's public files download successfully. `parameters.csv` contains 38 rows and columns including `Name`, `Power (W)`, `Velocity (mm/s)`, `Hatch Spacing (um)`, `Layer Height (um)`, `Volume (mm^3)` and `Threshold (um)`. `poredf.csv` contains **more than one million pore rows** (first million sampled) including `Name`, `Equivalent Spherical Diameter (um)`, `Aspect Ratio`, `Sphericity`. No known `build_id` column appears. The observed `Name` field is a **candidate specimen join key**, not verified physical independence. **The expanded audit found 38 distinct parameter Names, 39 pore Names in its first million rows, but only 37 shared names. At least one parameter specimen has no corresponding observed pore name in that sample and at least two pore names are not present in the parameter file.** We must resolve the mismatch against the original publication or author-provided metadata; no unreviewed join is allowed.

## Run source audit

The `Audit CMU CT porosity public source files` GitHub Actions workflow downloads original CSVs into a temporary CI runner, validates Figshare file sizes and MD5 checksums, and emits an audit JSON artifact. The next stage attempts an explicit Name-based specimen summary and **fails closed if any pore Name is not listed in the parameter file**. Such a failure indicates a source-data mapping blocker, not a failed upload. It intentionally does not publish datasets, labels, model artifacts, or live API predictions.

To run locally:

```bash
python ml/download_cmu_ct.py /tmp/orientai-cmu-ct
python ml/audit_cmu_ct_porosity.py \
  --parameters /tmp/orientai-cmu-ct/parameters.csv \
  --pores /tmp/orientai-cmu-ct/poredf.csv \
  --report /tmp/orientai-cmu-ct-schema.json
```

## Next data review before any defensible model

1. Confirm `Name` is one-to-one in the specimen-parameter table and many-to-one in the individual pore table. Do not treat pores as independent builds. Verify the full pore table, not merely a truncated sample.
2. Confirm CT voxel resolution, detection threshold, specimen volume units and measurement completeness; define the specific target (e.g. CT-observed pore count density). Individual pore-equivalent sphere sizes alone do **not** establish volumetric porosity without geometric/segmentation validation and complete pore coverage.
3. Resolve actual physical `build_id` from publication/source metadata or contact the authors; no names or IDs may be invented. Hold out independent builds, not random pore rows or parameter duplicates.
4. Decide model inputs available **before the print**. Only verified machine settings are candidates. Exclude CT `Threshold`, pore descriptors, post-build geometry/volume if not known before printing, and derived extreme-value-distribution parameters (`Scale`, `Shape`, `Rate`, etc.).
5. Check sufficient independent specimens/builds, compared to measured-sample-grouped baselines and blinded held-out outcomes. The 38 sample rows are too few to satisfy ORIENTAI's current minimum 60 specimens / 6 physical builds for the lack-of-fusion gate.
6. Distinguish measured CT porosity from independently diagnosed *lack-of-fusion*. The source's CT pore measurements are not automatically certified mechanism-specific lack-of-fusion labels.
7. Do not connect models to the ORIENTAI STL quality-risk interface without separate validation, input applicability/domain checks, calibration and engineering review.

Aalto's image-classification importer remains separate and untouched. These public research data are not Boeing part records.
