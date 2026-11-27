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
