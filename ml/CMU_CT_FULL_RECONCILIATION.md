# CMU Ti64 CT pore specimen-name reconciliation — full source audit

Original public source: Justin Miner and Sneha Prabha Narra, 2024, https://doi.org/10.1184/R1/26304175.v1.
Audit: https://github.com/Wickey23/boeing-vt-am-first-time-quality/actions/runs/43654261638

## Complete source counts (not independent training examples)

The source-byte-verified `parameters.csv` contains **38** rows and **38** distinct `Name` values.
The source-byte-verified `poredf.csv` contains **1,024,745** individual pore rows across **41** distinct `Name` values.

All **38/38** parameter specimen names are present in the *complete* pore file. Earlier analysis sampled only the first million pore rows and incorrectly suggested that one parameter specimen was missing. The full scan resolves that apparent mismatch.

Three **pore-only** identifiers are not in the parameter table:

| Pore Name | CT pore records | Parameter record found? | Interpretation |
|---|---:|---|---|
| `CMU04-07` | 94,284 | No | Specimen-like name; source author must clarify missing manufacturing parameters. |
| `CMU04-23` | 80,685 | No | Specimen-like name; source author must clarify missing manufacturing parameters. |
| `Powder` | 11,635 | No | Likely powder-related measurement based on its name, but its role must be confirmed with the authors. |

There are **186,604** pore rows across these three unmatched names. They must not be joined to a guessed parameter record or relabeled as a printed part's inspection outcome. Any downstream analysis using only the 38 matched Names must explicitly describe the exclusions, confirm that these are distinct physical specimens, and verify CT volume/threshold comparability.

## Remaining blockers

- `Name` matches do not prove independent physical builds or identical sample geometry.
- CT pore detections are **not** automatically lack-of-fusion diagnosis, absolute void volume fraction, or part failure.
- There are only 38 parameter rows, below ORIENTAI's existing 60-specimen / 6-build **lack-of-fusion** gate.
- No verified build labels are present in either CSV, so build-separated model evaluation is not yet defensible.
- The parameter file contains post-build extreme-value statistics. These may be outcome descriptors, **never** pre-print predictive input features.

## Recommended resolution

1. Ask source authors whether `CMU04-07` and `CMU04-23` had parameter records omitted intentionally, and whether `Powder` represents powder particles rather than pores within fabricated specimens.
2. Request a specimen-to-physical-build mapping and description of scanned sample volume and CT segmentation threshold.
3. Keep the existing model disabled. After provenance is resolved, use an explicitly reviewed cohort of matched specimens for a **descriptive** pore study; train and evaluate a process-to-porosity model only when scientific and build-level validation requirements are satisfied.

No production ORIENTAI inference changes are included in this reconciliation.
