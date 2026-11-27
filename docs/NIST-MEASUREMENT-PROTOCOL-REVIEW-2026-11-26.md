# NIST AMB2022-03 measurement protocol review — 2026-11-26

## Sources
- Original workbook: https://doi.org/10.18434/mds2-2718 (acquisition and 228-row audit recorded in the completion execution plan).
- Weaver et al. (2024), *Cross-Sectional Melt Pool Geometry of Laser Scanned Tracks and Pads on Nickel Alloy 718 for the 2022 Additive Manufacturing Benchmark Challenges*: https://doi.org/10.1007/s40192-024-00355-5 (experimental methods, Figs. 1–3, Appendices 3–4).
- NIST benchmark descriptions: https://www.nist.gov/ambench/am-bench-2022-challenge-problems-and-measurement-results

## Source-confirmed grouping
| Workbook sample | Experiment | Previously audited rows |
|---|---|---:|
| BP1 | Single tracks on bare IN718 plate | 42 |
| BP2 | X-direction pad scans on bare IN718 plate | 94 |
| BP3 | Y-direction pad scans on bare IN718 plate | 92 |

Plate IDs do not identify independent multilayer powder-bed builds. Preserve part, case/line and section-position identities. Do not treat nearby tracks or sections as independent observations. Experiment type is confounded with plate identity in this source.

## Measurement contract
Single-track widths describe the full cross-section; pad widths represent a partial width affected by remelting. Keep the published values in millimeters without automatically doubling or merging them. Pad overlap metrics are separate targets. The paper discusses measurement uncertainty separately by target and experimental protocol; its cross-section location standard uncertainty is 0.2 mm, and its within-section track comparison uncertainty is approximately 3 micrometers at 95% coverage. Neither is a universal uncertainty for individual melt-pool predictions. Use the target-specific budgets and grouping from the paper before assessing numerical agreement.

The parser now records bare-plate ID, experimental protocol, width definition, powder presence and publication DOI. Unknown sample identifiers remain unknown. No build IDs or defect labels are inferred. Training readiness remains false.

## Proposed next gate (not executed)
1. Acquire the measurement-specific 2718_README.txt; the existing 2711 README is for deflection, not this workbook.
2. Re-run the amended parser on the original SHA-256 verified workbook and reconcile all 228 records, missing targets, repeated case/line IDs and measurement units with source tables.
3. Pre-register separate exploratory single-track and pad measurement prediction tasks. Group repeated measurements by specimen/case/section as appropriate; compare a simple baseline and process-parameter model using group-aware splits. Report MAE/RMSE in millimeters and coverage, and do not interpret a case-held-out result as independent-build validation.
4. For independent experimental validation, acquire a compatible external plate or build dataset, verify definitions and freeze its holdout before fitting. Keep bare-plate and powder-bed applicability distinct.
5. No defect classifier or production probability until inspection-derived labels and independent build identities exist.

Source article reviewed; original local workbook not reprocessed in this connector session. Regression changes are subject to new CI. No application deployment, production validation, trained model or defect accuracy is claimed.


## Measurement README and reconciliation follow-up

The official measurement-specific README was read at https://data.nist.gov/od/ds/mds2-2718/2718_README.txt (redirected to the NIST cache). It confirms the NIST AMMT instrument, BP plate and P section naming, individual-track case/track naming, optical micrograph scaling, and the distinction between single-track and pad measurements. The source permits reuse and derivatives subject to attribution and its stated terms; modifications should identify the date and nature of changes. See the README for full terms. No original data or reconstructed README bytes were committed.

The downloader now requests the measurement-specific README in addition to the workbook and separate deflection README. The reconciliation gate checks the previously recorded workbook SHA-256, README identity markers, exact plate row totals, unique source rows, lack of invented build IDs/labels, and summarizes missing targets and process-parameter tuples by plate.

Run from the repository root on a network-enabled machine:

```bash
python scripts/fetch-nist-lpbf-measurements.py --output data/nist-lpbf
python scripts/reconcile-nist-source.py --source-dir data/nist-lpbf --output data/nist-lpbf/reconciliation.json
python -m unittest discover -s tests -p 'test_nist*.py' -v
```

The workbook hash is the prior audit's recorded digest, not a newly fetched publisher checksum. The raw files were not accessible in the current execution environment; the real reconciliation remains outstanding and new CI must complete. The README was reviewed as rendered text, not as a locally hashed original. The gate is intentionally not a model-training approval. No model or production change has been deployed.


## Pinned workbook identifier reconciliation

Research run [45926763440](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45926763440) downloaded all three sources, verified the workbook digest, and stopped at count reconciliation. Diagnostic run [45935493715](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45935493715) showed exactly 228 rows: AMB2022-718-SH1-BP1=42, AMB2022-718-SH1-BP2=94, AMB2022-718-SH1-BP3=92. The problem was full source identifiers rather than missing measurements. The measurement README SHA-256 acquired by CI was 8fa24c82e087a43ea453f9dbab7e56acfccb421a4b5afa620992142967a45274.

The parser now maps only those three exact full identifiers to the documented canonical plate IDs, retaining the original value in source_sample_id and raw_cells. Unrecognized IDs are not mapped by suffix. Expected counts and provenance gates are unchanged. The updated parser is subject to fresh CI and real-source benchmark execution; no numerical performance or independent physical-validation claim is made here. Work is isolated in PR #29 to avoid collisions with the CTQ editor currently being implemented on PR #28.
