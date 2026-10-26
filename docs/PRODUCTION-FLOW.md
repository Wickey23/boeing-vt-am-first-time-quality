# Production-flow simulation, version 0.1

This module complements the part-specific thermal and service-load studies. It answers manufacturing-flow questions: how long a finite batch takes, where builds wait, how busy resources are and what the entered busy-hour rates imply. It does not calculate stress, temperature, distortion, defects or inspection acceptance.

## Implemented model

Six fixed serial stages: preparation, printing/in-machine cooling, depowder/plate handling, heat treatment, support removal/finishing and inspection. Review this route against the real process; different ordering, batching and shared resources need a later model.

Each entity is one build containing one part. Release a finite batch simultaneously or at a fixed interval. Stages have deterministic duration, 1–8 independent parallel resources, FIFO dispatch, unlimited queues and 24/7 operation. Events record each arrival, resource assignment, processing start and finish. The network starts empty and drains every released build. Fixed durations and no routing loops let stage-wise arrival-event scheduling exactly represent this restricted queue network.

Metrics: final completion time, mean release-to-completion lead time, mean total waiting, completed jobs, finite-batch throughput, time-average WIP and resource utilization. WIP is total flow time divided by the zero-to-final-completion observation period. Utilization divides each station's total busy time by capacity times that same observation period. Cost sums busy processing hours times supplied rates only. Zero rates mean incomplete costing, not zero real cost.

## Part linkage and persistence

The page consumes the shared uploaded-part analysis; no second upload occurs. Applying the selected orientation uses its geometric build-time estimate, with candidate identity recorded. This estimate excludes cooling and is not a slicer-derived build time. Editing printer duration changes the basis to user assumption; add printer-occupying cooldown before applying a scenario.

Configuration and completed results are stored in the current analysis and included in saved revisions, project exports and JSON/PDF engineering reports. Scenario edits clear its result. Manufacturing edits invalidate the entire orientation run and this flow scenario; service-load inputs retain their separate persistence. Save named revisions to compare production scenarios. Portable imports recalculate deterministic flow results from their saved input instead of trusting supplied outcome values.

## Verification

Unit tests verify single-server queues, parallel resources, spaced releases, downstream waiting, non-overlap, routing precedence, lead-time conservation, determinism and invalid-input rejection. Browser regression checks the shared part/run, reports, navigation/reload persistence and invalidation.

Illustrative default times are not manufacturing data. No distributions, confidence intervals, breakdowns, calendars, shared workers, furnace batching, transport, rework or scrap are modeled. Inspection completion does not imply acceptance. A busy station is only a bottleneck candidate; validate through controlled scenario changes.

## Relationship to Simio and next steps

This is an ORIENTAI process-flow model, not a native Simio project, Simio runtime integration or replacement for a validated plant model. The same routing, capacity and duration assumptions can guide a separately built Simio model if the team has access to the software. Native model-file compatibility has not been implemented or tested.

Next: review the team's real process map; collect build/setup/cooling/postprocess/inspection times and resource calendars; decide what is processed per part, plate or batch; add saved side-by-side scenarios; then add measured stochastic distributions and independent replications. Rework/scrap routing requires observed inspection outcomes and traceable assumptions, not invented failure probabilities or geometric proxies.

References:
- Simio DES overview: https://www.simio.com/discrete-event-simulation
- Published LPBF DES/cost study (research context, no input values copied): https://www.nature.com/articles/s44334-025-00036-x
