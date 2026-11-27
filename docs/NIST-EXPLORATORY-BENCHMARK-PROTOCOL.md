# Exploratory NIST melt-pool benchmark — frozen protocol v1

This is the next implementation step toward ML-01 in the completion execution plan, **not** its independent-build validation acceptance. The benchmark estimates measured cross-sectional dimensions of bare IN718 laser tracks/pads under a narrow experimental protocol. It is not a powder-bed defect predictor, process qualification, or production inference service.

## Frozen comparison

- Data: original workbook and measurement-specific README, checked by `reconcile-nist-source.py`. The workbook must match the previously audited SHA-256 and 228-row plate totals; changes require source review.
- Six independent evaluation tasks: BP1, BP2 and BP3, each with measured depth and measured width in millimeters. Never pool the full single-track width with partial pad width. Overlap measurements are not modeled.
- Exclude missing/nonfinite/negative target values and missing/nonpositive laser power, speed or beam diameter; retain counts. Zero measured dimensions are retained.
- Process-condition key: exact published power, speed and beam diameter tuple, within each plate. All repeated rows of the held-out tuple stay together. This does not prove specimen independence; different conditions can share the same physical section. No holdout across different protocols is claimed.
- Baseline: training-only mean of condition means. Candidate: fixed ordinary least squares of condition means against line energy (power / scan speed, J/mm). Equal condition weights avoid treating repeated sections as additional independent conditions. No hyperparameter search.
- Abstain if fewer than three training conditions, constant training line energy, held-out feature outside its respective observed training range, or negative/nonfinite candidate prediction. Axis-aligned ranges are a conservative screening rule, not validated applicability.
- Primary comparisons: condition-balanced MAE and RMSE on identical non-abstained held-out rows for both models; report eligible row and condition coverage and exclusion counts. Per-fold predictions, errors, source-row identifiers and abstention reasons remain in the local JSON. No calibrated prediction interval is asserted.
- No numerical pass threshold has been supplied by the engineering team. These exploratory comparisons must not be interpreted as a release gate or production tolerance.

## Run

```bash
python scripts/fetch-nist-lpbf-measurements.py --output data/nist-lpbf
python scripts/benchmark-nist-melt-pool.py --source-dir data/nist-lpbf --output data/nist-lpbf/exploratory-benchmark.json
python -m unittest discover -s tests -p 'test_nist*.py' -v
```

## Acceptance evidence and limitations

Synthetic unit tests cover condition holdout, separation of plates, held-out target leakage, missing inputs, constant energy, inadequate group counts and abstention. Synthetic tests establish behavior only. The original workbook is not available in the current execution session, so real metrics have not been computed. Do not claim training performance, calibrated uncertainty, independent experimental validation or defect accuracy. Before independent validation, obtain compatible independent specimen/build evidence, freeze a separate holdout and engineer-approved error thresholds, and document target-specific measurement uncertainty. Keep all experimental outputs out of the public repository pending data-use review.


## Network-enabled execution route

The separate research-only workflow `.github/workflows/nist-experimental-benchmark.yml` runs on relevant pull requests (and supports manual dispatch when available on the default branch). It attempts acquisition on a GitHub-hosted runner, requires both the measurement workbook and matching README, then executes pinned-source reconciliation and the frozen benchmark. It does not require secrets or deploy application changes. A failed download or source mismatch fails this research job explicitly, independently of the application engineering workflow.

The workflow retains the source acquisition manifest and aggregate benchmark summary for seven days. Original bytes, specimen/section identities, row-level observations and fold-level errors are not uploaded as artifacts or committed. Aggregate results still carry the source and method limitations. Do not treat workflow creation or a successful software check as a physical-model acceptance result. Record the actual run SHA, status, coverage and errors only after the research job finishes. The current session's direct NIST download failed at DNS resolution; the new workflow is an attempted alternative, not a confirmed successful acquisition.
