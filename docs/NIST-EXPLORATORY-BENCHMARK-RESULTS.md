# NIST exploratory benchmark v1 — executed evidence

Research run [45935554316](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45935554316), branch commit 3663cf64cc85d94d0d5cb884111aefbe9011daa0, completed acquisition, source reconciliation and exploratory benchmark successfully. Workbook SHA-256 2cfaac96aaca3dabb77b7029f842cdcc7e75c5a2cf3577d0734823246364a931. README SHA-256 8fa24c82e087a43ea453f9dbab7e56acfccb421a4b5afa620992142967a45274. All 228 measured depth and width rows were present.

| Plate/target | Rows | Distinct conditions | Covered rows | Baseline MAE (mm) | Candidate MAE (mm) | Both RMSE (mm) |
|---|---:|---:|---:|---:|---:|---:|
| BP1 depth | 42 | 7 | 6 | 0.01008933 | 0.01008933 | 0.01024367 |
| BP1 width | 42 | 7 | 6 | 0.00617742 | 0.00617742 | 0.00670982 |
| BP2 depth/width (each) | 94 | 1 | 0 | unavailable | unavailable | unavailable |
| BP3 depth/width (each) | 92 | 1 | 0 | unavailable | unavailable | unavailable |

BP1 coverage is 1/7 conditions and 6/42 rows per target (14.29%). BP2/BP3 coverage is zero. Baseline and candidate errors are identical on the paired covered subset. The experiment establishes execution and negative/insufficient predictive evidence, not a usable prediction model. Keep the model out of the application. No calibrated uncertainty, independent build validation, defect labels or approval. Do not loosen the frozen range checks after inspecting results to obtain apparently better coverage.

## Next source candidate

NIST supplemental single-track measurements: https://doi.org/10.18434/mds2-2923. The catalog https://catalog.data.gov/dataset/single-track-laser-scan-cross-sectional-micrographs-on-in625-and-in718-bare-plates-with-me describes IN625/IN718 bare-plate experiments across AMMT, EOS M270 and M290, varying laser power, speed and spot diameter. The README defines width and depth from bounding boxes below the original plate surface, and distinguishes estimated spot diameters on commercial systems from measured AMMT diameters. The README header DOI is 2923 but its suggested citation mentions 2716; resolve that metadata discrepancy before formal publication. Preserve both source identifiers, and do not combine alloys or treat measurements already appearing in other NIST studies as independent. Source overlap, plate/track identity, measurement units and beam diameter definitions must be established first.

Acquire only the master workbook and README initially:
- https://data.nist.gov/od/ds/mds2-2923/Master_TrackList_Measurements.xlsx
- https://data.nist.gov/od/ds/mds2-2923/2923_README.txt

The audit must inspect sheet layout and column schema before parsing measurements. Retain original file digests, don't download hundreds of microscopy images unless needed, and keep raw sources out of the repository. Predeclare a new evaluation protocol with physical plate and machine grouping, an independent holdout, no leakage across repeat measurements, and uncertainty treatment before fitting. Neither this source nor the previous bare-plate benchmark proves multilayer powder-bed performance.


## Supplemental workbook acquisition and grouping audit

Run [45935881475](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45935881475) on 7eab7cee14614f6457fca8f8191a4d34a2fb8ea0 acquired both supplemental files. Workbook SHA-256: 6cd32669f5c84cdb9e90890ba40ddc5548c85b0dbb95cf038f2f6fc69da67a52; README SHA-256: 8b8fc00ce62915af3e0c91c138dc4d033c031d7758161fb9da0e8702fa621c39. The Data sheet has 251 populated rows including headers, zero formulas; the Summary sheet has 71 populated rows including headers. The latter is derived evidence, not additional independent observations. Engineering and original benchmark runs on this same SHA also succeeded.

The new `scripts/audit-nist-supplemental-groups.py` checks both hashes and exact Data sheet headers, requires 250 data rows, reports complete identities, duplicate image keys, distinct sample/track keys and process tuples separately for each alloy and machine. It records missing/nonfinite/invalid numeric fields, surface and scan direction categories and per-target group eligibility. Spot diameter is intentionally kept as a raw numeric value pending unit/definition review. No raw observations or sample names are uploaded. The existing supplemental workflow now executes this audit on the downloaded originals. The new tests use synthetic fixtures only. Actual group counts and updated CI are pending at the time of writing. Group counts are not proof of physical independence, and cross-source overlap remains unverified; no model has been promoted.


## Supplemental grouping results and frozen sample-name-held-out benchmark

Run [45937223239](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45937223239) passed on commit 4d6804f20e55582bab08cbdad2acafde13bb383d, as did the engineering and original experimental workflows on that SHA. All 250 rows have complete identity fields and numeric targets/process inputs. There are 33 excess occurrences of shared folder/image keys (not necessarily duplicate measurements). Group inventory:

| Alloy | Machine | Rows | Distinct sample names | Sample/track keys | Distinct process settings |
|---|---|---:|---:|---:|---:|
| IN625 | AMMT | 34 | 2 | 34 | 14 |
| IN625 | EOS M270 | 144 | 5 | 72 | 60 |
| IN718 | AMMT | 54 | 2 | 36 | 6 |
| IN718 | EOS M290 | 18 | 1 | 1 | 1 |

The new benchmark is frozen before observing its results: stratify by exact alloy, machine, surface, direction and raw spot category; conservatively exclude every row sharing a folder/image key pending clarification; average repeated observations only within the same sample/track/setting. Hold out one sample name at a time, requiring at least two training sample names and three distinct training settings. Compare a training-only sample/setting-balanced mean with weighted linear regression on power/speed. Abstain outside training power, speed and line-energy bounds or on invalid predictions. Report sample-balanced MAE and RMSE in micrometers on identical covered points, with sample and point coverage. Do not pool alloys or cross-source rows. A spot category is not a calibrated diameter; sample names are not verified independent physical builds. IN718 has at most two sample names per machine before further stratification, so it cannot meet this benchmark's minimum training-group gate; the IN625 subset is a separate research task, not a proxy validation of IN718.

The supplemental workflow now executes the benchmark after the pinned grouping audit. Synthetic regression tests cover group exclusion, duplicate-image removal, protocol separation and abstention. New real-source results and CI are pending; no production integration, uncertainty calibration, or independent physical validation is claimed.


## Executed supplemental benchmark: no eligible holdout predictions

Run [45938109928](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45938109928) on 2eae0305d90a370aa4f26cb7e5f424a3f960b343 passed, as did engineering and the original benchmark at that commit. Of 250 source rows, 66 rows were excluded because their folder/image key was shared, leaving 184 rows. Per target, the remaining 113 track/setting points consist of 34 IN625 AMMT, 73 IN625 EOS M270 and 6 IN718 AMMT points. Every point abstained for insufficient training sample names or settings; coverage is zero and error metrics are unavailable. No candidate model is approved. Keep the frozen protocol unchanged and investigate new experiments rather than weakening gates after observing these results.

## Next IN718 experiment source: AM Bench 2025 pads

Official source: https://doi.org/10.18434/mds2-4103; catalog and file listing: https://catalog.data.gov/dataset/am-bench-2025-measurement-results-data-optical-microscopy-of-arrays-of-adjacent-laser-trac. The experiments compare pad geometry, laser turnaround time and powder layer thickness on bare plates or plates with a single powder layer. Primary laser parameters and hatch spacing are fixed. This may support targeted model comparison, not general power/speed regression, multilayer prediction or a binary defect classifier.

Implemented a research-only acquisition/inventory script for the README, parameter CSV and four unaveraged measurement CSVs (depth, width, overlap depth and overlap width), verifying the original publisher SHA-256 sidecars before accepting each staged file. Only first-row schema candidates and aggregate row-width counts are retained; no specimen observations are uploaded. The separate CI workflow runs offline checksum/CSV safeguards first. The download and inventory results are not yet verified. Before any numerical use, review units, sample/section/track relationships, powder conditions, source independence and measured target definitions. Do not join or pool data with previous sources by assumption.

Other candidate for a separate structural/defect workstream: https://doi.org/10.18434/mds2-3083 contains actual LPBF IN718 specimens with mechanical and pore measurements across processing conditions, but the catalog states that the studies share one build; do not use it as multi-build independent validation. Consider the published eight-sample thermal measurement study https://doi.org/10.1007/s40192-023-00323-5 for a separate thermal validation effort; original files and experimental provenance are not yet acquired.


## AM Bench 2025 acquisition integrity follow-up

Run [45938974172](https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/45938974172) on a9666bb155c8e4b60c4a7a62e45f3b9701f71868 passed all three offline safeguards but failed publisher SHA-256 verification during acquisition. Engineering, original benchmark and supplemental benchmark workflows passed on the same SHA. The original error did not expose which file or digest failed; the new downloader records each file and endpoint's expected digest, observed digest, byte count, and outcome. It retries the alternate official NIST dataset path only with a matching publisher sidecar, preserves previously accepted files when downloads fail, and continues investigating the remaining files while failing the overall job if any are unverified. It publishes aggregate schema evidence and rejection diagnostics even on failure. No mismatch is overridden and no new physical data are accepted on the basis of this change alone. New CI and live acquisition outcomes remain pending.
