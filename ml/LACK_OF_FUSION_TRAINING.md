# Measured LPBF lack-of-fusion research baseline

## Status
**Research-only pipeline. No verified inspection-labeled defect dataset is currently committed. No production inference is allowed.** The existing MeltPoolNet study measures melt-pool geometry, not observed lack-of-fusion outcomes. Do not relabel it as defect ground truth.

## Required observations
Copy `ml/LACK_OF_FUSION_LABELS_TEMPLATE.csv` and populate it only from independently inspected **physical LPBF builds** with documented authorization. Each row is an inspected specimen in one physical `build_id`. At minimum, supply original and independently checked:
- Specimen identity, build identity, material, machine, process revision.
- Inspection method, traceable inspection reference, and identical predeclared binary lack-of-fusion outcome definition.
- Observed label (0 or 1), not a guess, calculation or visual STL overhang warning.
- Laser power (W), scan speed (mm/s), hatch spacing (mm), and layer thickness (mm).

The same alloy/machine/revision/outcome definition must be used across the dataset. Record all source citations, inspection threshold, machine settings, and process provenance outside the CSV in a controlled manifest. Exclude export-controlled or proprietary parts unless approved. Never upload protected aerospace information to a public repository.

## Running the exploratory study

```sh
python -m pip install -r ml/requirements.txt
python -m unittest discover -s ml/tests -v
python ml/train_lack_of_fusion.py --csv /authorized/measured_lof.csv --report /tmp/lof-research-report.json
```

The gate requires at least 60 inspected specimens and 6 independent build IDs, with both outcome classes and nonplaceholder provenance. **These counts are basic software gate minimums, not proof that the study is statistically adequate.** A single prespecified grouped split (seed 42) separates all specimens from each build into either training or holdout, and fails if one outcome class is absent on either side. It fits a standardized logistic regression and compares Brier score against prevalence from training only. The report records the exact input SHA-256, grouped train/holdout build IDs, cases, confusion matrix, balanced accuracy, ROC-AUC, and explicit release blockers.

## Validation limitations

- The script cannot independently verify that labels, inspection references, or build IDs are genuine. A researcher must audit physical records and measurement definitions.
- Software-only tests use fabricated data solely to test rejection conditions, never to claim defect accuracy.
- No confidence intervals, external-machine validation, process drift monitoring, or approved engineering acceptance criterion is available.
- No probabilities from this research script may enter ORIENTAI's live risk reports or be interpreted as certified failure rates.
- Do not combine this binary lack-of-fusion target with dimensional distortion, cracks, support volume, tensile strength, or melt-pool dimensions; those are separate measured outcomes and models.
- Subsequent release work requires independent source checks, a locked evaluation plan, build-level external validation, calibrated uncertainty, and engineering owner approval.

See also [the defect-validation protocol](../docs/LPBF-DEFECT-PREDICTION-VALIDATION.md) and [data acquisition plan](DATA_ACQUISITION.md).
