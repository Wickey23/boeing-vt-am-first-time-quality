# ORIENTAI public LPBF experimental data acquisition

Verified source catalog: NIST AM Bench direct data links (updated 2026-11-06):
https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance

These are **real experimental measurement publications**, not pre-labeled build failure probabilities.
No proprietary or controlled CAD is needed.

## Prioritized IN718 measurements
| Name | Primary purpose | DOI | Direct file |
| --- | --- | --- | --- |
| AMB2022-03 cross-sectional melt-pool geometry | Verify melt-pool width/depth and scan-parameter models; possible lack-of-fusion *mechanism* foundation | https://doi.org/10.18434/mds2-2718 | https://data.nist.gov/od/ds/ark:/88434/mds2-2718/AMB2022-718-SH1-MeltPool_Cross-Section_Measurement_Results.xlsx |
| AMB2022-01 IN718 deflection & residual strain | Validate distortion / stress models against measured deflection | https://doi.org/10.18434/mds2-2711 | https://data.nist.gov/od/ds/mds2-2711/2711_README.txt |
| AMB2022-01 CT and serial sectioning | Inspect actual measured 3D defect morphology; substantial image processing and alignment necessary | https://doi.org/10.18434/mds2-2767 | Visit NIST PDR DOI for data |
| AMB2022-01 in-situ thermography | Validate time-temperature thermal models, not binary defect accuracy | https://doi.org/10.18434/mds2-2715 | Visit NIST PDR DOI for data |
| AMB2025-06/07 optical microscopy pads | Independent later melt-pool comparison (different experimental setup) | https://doi.org/10.18434/mds2-4103 | Visit NIST PDR DOI for data |

NIST's data publication metadata and files are hosted at data.nist.gov; if a direct URL changes, resolve it through the DOI landing page instead of silently substituting data.

## Download the starter source files
With Python 3.10+ and network access from a trusted computer, from repository root:

```bash
python scripts/fetch-nist-lpbf-measurements.py --output data/nist-lpbf
```

Downloaded files stay in `data/nist-lpbf/` and should not be committed without checking individual rights/terms, size, and provenance. Preserve original bytes and SHA256; never reinterpret material or measurement units without checking the dataset documentation.

## Required next data engineering work
1. Read the NIST README and cross-sectional workbook metadata, identify actual tab names, units, specimen IDs, measurement uncertainties, processing settings and missing values.
2. Build a typed normalized table with columns `source_doi,build_id,specimen_id,material,machine,power_w,speed_mm_s,measured_width_mm,measured_depth_mm` only where directly supported. Keep empty fields null.
3. For distortion, extract deflection coordinate + displacement and preserve measurement reference frame and release/cut condition.
4. Define any **lack-of-fusion** label only from an explicit inspected criterion (e.g. observed connected lack-of-fusion morphology), not from an arbitrary melt-pool width/depth cutoff. The current workbook does **not** supply general binary failure labels.
5. Split by independent build/specimen groups, not adjacent pixels/layers from the same build. Record real test metrics, uncertainties and any abstentions.
6. Do not report universal defect probabilities or use NIST research benchmarks to certify aerospace parts.

Acquisition note (2026-11-14): Source pages and two direct NIST file paths were identified; raw measurement bytes were **not downloaded or parsed in this session** because this execution environment cannot reach the NIST file host. The script below is provided for reproducible download on a network-enabled machine.
