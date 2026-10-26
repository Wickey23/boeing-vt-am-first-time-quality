# Orientation machine learning (research only)

## Target and input provenance
The first model learns **slicer-reported support volume in cubic millimeters**. It does not learn certification, mechanical strength, thermal distortion or defect probabilities. Input rows must come from real measured slicer outcomes, not the geometric support-volume proxy itself.

Use a single locked manufacturing profile per training CSV: machine model, material, slicer version, settings, support algorithm, build plate configuration and part-processing conventions. Record the profile in `process_profile_id`. Geometry units are millimeters.

## Training
```sh
python -m pip install -r ml/requirements.txt
python ml/train.py --csv measured_slicer_orientations.csv --output ml/models/support-model.json
```
Minimum: 30 labeled rows from 5 distinct parts. Splits are grouped by `part_id` to avoid orientations of the same part appearing in training and holdout. Ridge regression is intentionally a transparent first baseline. Model export fails if holdout MAE does not improve on the geometric proxy MAE.

The JSON is portable into the Next.js application. No pickle is loaded by the deployed server. `GET /api/ml/predict` indicates whether a model has been provisioned. `POST /api/ml/predict` accepts `{"profileId":"...","features":{"build_height_mm":...}}` with **all seven** named numeric features.

## Safety and validation
- All model outputs are research predictions, not qualified manufacturing process data.
- Never use training/evaluation rows derived from synthetic ground-truth labels to justify aerospace use.
- Review held-out error and distribution shift by component family; retrain after slicer/process changes.
- Different machine/material/slicer profile needs independent validation and model.
- Hard safety and qualification constraints must be checked independently of ML.
- ML predictions do not establish strength, inspectability, structural acceptability, build success or part certification.
- Do not upload proprietary or export-controlled Boeing CAD, inspection or manufacturing records to unapproved external services.

## Melt-pool reproducibility and evaluation audit

Run the pinned research environment and checksum-locked evaluation:

```sh
python -m pip install -r ml/requirements-reproduction.txt
python -m unittest discover -s ml/tests -v
python ml/reproduce_meltpoolnet.py --expected-sha256 197b111bcb3c531d38c8dd7ea0d4e1f78c8b6b03e0fd900a5505c2b18414a4f6 --out /tmp/orientai-ml-evaluation.json
```

The report retains the original 178/49 study split, adds per-study MAE/RMSE, leave-one-development-study-out checks with fold-local scaling, row-level split identity, model/split hashes, training feature ranges and data-filter counts. Cross-study duplicate feature/target records block evaluation pending provenance review. Duplicates within the filtered data are counted, not silently removed or treated as independent experiments.

GitHub Actions runs the tests and full public-data reproduction and retains the JSON as the `orientai-ml-evaluation` artifact. It does not silently replace the app's checked-in historical report or deploy a model. The exact recorded KNN baseline is checked in the pinned environment; a future discrepancy fails CI for investigation rather than adjusting the expected result.

These metrics use source target units that remain unverified. The holdout is from the same compiled dataset, not external validation. Feature min/max checks are not a validated applicability domain. Melt-pool and tensile pipelines leave inference and release eligibility disabled. Beating a mean baseline is recorded separately and never grants release approval.
