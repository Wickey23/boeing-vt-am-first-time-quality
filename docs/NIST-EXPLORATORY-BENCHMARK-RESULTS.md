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
