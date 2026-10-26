# ORIENTAI engineer-first workspace — implementation handoff

**Status:** implementation changes on branch `integration/unified-engineer-workflow-20261026`; independently verify CI/preview before merging. This file does not assert acceptance or physical validation.

## Product change
The main `/orientation` route is now a guided, seven-stage engineering project: Part → Requirements → Print process → Options → Simulations → Decision → Report. The actual uploaded part stays visible throughout. The entry point at `/` prioritizes resuming a project or explicitly opening a DED teaching example. Global navigation now emphasizes Projects, Current analysis and Report; older labs and ML are secondary.

## Geometry and simulation identity
- Uploaded STL: `AnalysisProvider` source geometry, mesh inspection, original-part load cases and candidate runs. LPBF candidate rankings are geometric research estimates only.
- Synthetic DED teaching project: explicitly different project `mode: ded-example`, with existing verified wall/path and internal reference DES; neither its wall nor timing is substituted for an uploaded STL.
- Uploaded STL + DED selected: no arbitrary-STL deposition path engine. The project explicitly reports unsupported / not evaluated and suppresses LPBF recommendations in the guided flow and report.
- Model verification: original part fixtures use original STL coordinates; manufacturing and service model limitations remain documented.
- DED factory inputs are illustrative, not real shop-floor data or a licensed Simio run.

## Migration and persistence
- The existing browser IndexedDB workspace `schema:1` is retained and extended with an optional `journey: {schema:2,...}` so existing part and service case snapshots restore.
- `ORIENTAI_PROJECT_V1` portable backups remain importable; new backups add an optional guided journey record, preserving earlier format compatibility.
- An explicit `DED teaching wall` action resets the active part before loading synthetic geometry. Uploading an STL starts uploaded/LPBF mode and resets dimension confirmation.
- Local drafts continue to be unencrypted browser storage, not a secure CAD vault. Do not upload controlled Boeing data.

## Route map
- `/`: projects landing and explicit DED start
- `/orientation`: guided single-project workspace
- `/orientation/advanced`: legacy advanced multi-tab part workbench retained for backward functionality and QA
- `/simulation`: redirects to `/orientation?step=studies`
- `/simulation/lab`: standalone advanced DED wall research lab
- `/simulation/benchmarks`: isolated numerical solver benchmarks
- `/report`: LPBF engineering report for uploaded STL only, or guided report link when DED/non-supported

## Tested journey targets
1. Beginner uploads a cube STL, reviews dimension confirmation, defines original-part load case, configures LPBF, generates candidates and exports project with matching service plan/process.
2. Beginner selects the synthetic DED wall, configures feed variant, compares deposition strategies, runs deterministic shop-floor reference and exports CSV/JSON labeled research only.
3. Uploaded part process switch to DED displays unsupported state, never another geometry's DED results, and retains service loads.
4. Existing advanced numerical and browser regressions run under `/orientation/advanced`; standalone DED lab tests continue at `/simulation/lab`.
5. TypeScript, production build, numerical data tests, desktop/mobile UI tests and preview deployment gates must pass prior to release.

## Limitations / follow-up
- The new primary requirements form still supports the existing end-face idealized fixtures, not realistic CAD surface region restraints; advanced solver panels are available at simulation stage.
- The main DED project remains a teaching wall; linking arbitrary uploaded parts to physical deposition planning, kinematic reach and thermomechanical/quality validation is a separate future engineering package.
- The standalone DED teaching lab is maintained for research parity while the unified route becomes canonical.
- The report for the LPBF part remains the existing consolidated engineering PDF/JSON, while the DED teaching example exports a separate explicitly labeled JSON review plus Simio table ZIP. A validated cross-process report generator remains future work.
- The preview image viewer depends on browser WebGL; accessibility and visual QA should verify mobile behavior.
