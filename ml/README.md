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
