# Real-data ML implementation tracks

## Track A — material response versus build direction
Use only original tabulated **measured** LPBF tensile data with angle, material, process profile, independent study ID, specimen ID, measured yield strength (MPa). Starter public references: [NIST AM Bench](https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance); [IN625 build orientation experimental study](https://zenodo.org/records/20503603). Do not guess angles from labels or report a combined material model without normalizing orientation conventions and validating comparability.

Training command: `python ml/train_material_orientation.py --csv measured_tensile.csv`. Models use study-held-out cross validation, with a mean-strength baseline. The generated report is not a certified model or engineering allowable. Data is not automatically pulled from websites: researchers must inspect original columns/units, licensing, specimens and heat-treatment provenance.

## Track B — real support-volume labels
Export real orientation-evidence JSON from the workbench. For a defined metal AM material/machine/slicer profile, load each candidate into the slicer and record its reported supports in mm3. Collect original geometry volume and area from a verified mesh inspector. Create a manifest JSON array with `part_id`, `process_profile_id`, `evidence_path`, `part_volume_mm3`, `surface_area_mm2`. Fill `ml/SLICER_LABELS_TEMPLATE.csv`, then:

```sh
python ml/collect_support_labels.py --manifest manifest.json --labels slicer_labels.csv --out ml/data/measured_support.csv
python ml/train.py --csv ml/data/measured_support.csv
```

Never use `supportProxyMm3` as measured target or transfer polymer FDM labels to metal LPBF. Both tracks require adequate public data licensing, source attribution, and authorization for any proprietary content.

## Release gates
Training scripts accept real input records; no matching training observations have been ingested into the project yet. Keep model status NOT TRAINED; do not claim certified predictions. For first supervised baselines, 30 records is a technical minimum and not evidence of engineering reliability. Increase independent holdout parts/studies and validate on actual builds before field use.
