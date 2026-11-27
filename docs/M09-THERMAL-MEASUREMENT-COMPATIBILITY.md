# M09 experimental thermal validation source compatibility

Status: source selection only; no measured-versus-modeled thermal validation has been performed.

## Official source records reviewed
- NIST AMB2022-01 IN718 3D build challenge description: https://www.nist.gov/ambench/amb2022-01-benchmark-measurements-and-challenge-problems
- Associated build description files: https://doi.org/10.18434/mds2-2607
- NIST AM Bench direct data index: https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance
- AMB2022-03 bare IN718 single tracks/pads thermography and scan strategy: https://doi.org/10.18434/mds2-2716
- Residual strain/stress and deflection measurements (future mechanical study): https://doi.org/10.18434/mds2-2711

## Compatibility decisions
AMB2022-01 provides under-plate thermocouple series for builds 6, 7 and 8 and a chamber thermocouple. These are not equivalent to the existing model's volume-cell temperature; the model uses an imposed plate-temperature reservoir and does not resolve the plate or chamber. Do not compare its imposed boundary value to the thermocouple data as a prediction. NIST surface thermography and derived melt-duration/cooling-rate quantities need a compatible surface observation operator, calibrated optical and thermal assumptions, adequate resolution and appropriate phase physics. AMB2022-03 bare-metal tracks and pads are a different geometry/boundary problem, not automatically a validation of a powder-layer solver. AMB2022-01 residual strain and deflection are later mechanical benchmarks, not temperature measurements.

## Required next evidence
Acquire and hash exact source files, retain original metadata and source uncertainty, map geometry and scan/time coordinates, freeze the measured observable and compatible model version, and choose nonoverlapping calibration and held-out builds. No source files were downloaded in this review. Build IDs and exact split are not yet selected. No parameter fitting, error statistics, experimental pass status or production authorization follows from this inventory. The compatibility gate rejects current surface, substrate, chamber and melt-derived observables; even a volume-average manifest only permits review for comparison, not validation.
