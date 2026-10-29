# ORIENTAI chat-first frontend milestones
Date: 2026-10-29
Branch policy for this delivery: user requested changes on main without new branches. These scoped changes preserve existing /orientation and numerical APIs. Recheck open PR #8 before merging because it also modifies legacy AppShell.

## Product goal
A ChatGPT-familiar conversational engineering workspace where a user can open a study, upload an authorized STL, ask questions, review actual geometry/physics results, and inspect those results in a persistent 3D artifact pane. AI explanations never substitute for numerical solvers.

## Milestone 1 — Chat shell and working entry flow
Scope:
- Isolated ChatAppShell on / and /copilot, keeping legacy AppShell unchanged for teammate work
- Collapsible desktop sidebar, mobile drawer, current-study shortcut, report and research links
- Clean centered welcome state and composer, Enter sends / Shift+Enter newline
- Local STL attachment validation (nonempty STL <=20 MB); direct handoff to existing AnalysisProvider
- First prompt is consumed once and answered by the existing local engineering guide; no automatic remote provider call
- Preserve legacy copilot stages under /copilot/advanced; the primary /copilot route uses the new conversation view
- Light/dark appearance and minimal responsive layout, security and research-prototype notice
- Browser tests for home, mobile, STL handoff and no unauthorized AI call

Acceptance: user can attach a supported part and send a question from /, reach /copilot with the part loaded and the message visible, without a remote AI call or numerical solve. Existing /orientation, reports and DED example routes remain available.

Status: Milestone 1 implemented and verified by GitHub numerical, TypeScript, production-build and browser tests. The original controls now live at /copilot/advanced.

## Milestone 2 — Native chat transcript and study persistence
Status: Partially implemented. The primary chat transcript, composer, localStorage persistence keyed by STL SHA-256, and active-file isolation are in source. A full multi-study selector/history service, rename/delete, and attached reference-document lifecycle remain future work.
Scope:
- Replace the expandable conversation section with a normal ChatGPT-style visible message feed
- Move composer into the conversation's fixed bottom area; responsive, keyboard accessible
- Conversation records belong to a project and a geometry revision, not a global unscoped history
- Rename, select and delete local studies; avoid promising cross-device history without a server
- Attachment chips for documents and CAD, source lifecycle and explicit transmission consent
- Preserve existing project export/import and source approval pathways

Acceptance: messages can be resumed after reload and switching studies never mixes different geometry/context. Existing analysis panel can be opened without leaving the chat.

## Milestone 3 — Artifact split viewer and structured analysis messages
Status: Partially implemented. Real uploaded STL preview inside the conversation, optional side viewer, actual mesh worker findings, orientation worker progress, geometric risk cards and a controllable 3D build-height clipping animation are in source. Simulation-result field selection, CAD-region-specific defect mapping, and validated print thermomechanical simulation remain unimplemented.
Scope:
- Responsive right-side persistent Three.js model pane; chat remains visible
- Typed cards for uploaded geometry, simulation state, engineering approval, risk findings and solver outputs
- Select card to open associated field and model region; show provenance, units, limitations and data identity
- Actual worker progress, error/cancel/retry states; never create phantom completion states

Acceptance: part-linked analysis updates the viewer and transcript together; stale results cannot render as current.

## Milestone 4 — ARC AI + streaming orchestration
Scope:
- OpenAI-compatible ARC provider adapter, configuration and health checks
- Server-only key, explicit project access policies, auth, rate and budget controls before public access
- Streaming tokens, safe retrieval of reviewed source text and structured tool proposals
- Deterministic approved tool registry and human approval for simulations/numerical inputs
- Clear local fallback when ARC is disabled
- No transmission of controlled data without documented approval

Acceptance: streamed assistant messages and approved analysis requests work without fabricating computations or exposing keys.

## Milestone 5 — Failure intelligence and quality review
Scope:
- Integrate a validated failure-mode taxonomy and bounded risk engine
- Geometry-linked risk locations, severity, uncertainty and unassessed modes
- Compare orientation/process alternatives and track model limitations
- Generate review report linked to exact CAD hash, settings, solver versions and evidence
- User testing with VT engineers; benchmark and validation results reported separately

Acceptance: every visible finding ties to source, solver/model and correct geometry; missing process information yields "not assessed," not unearned safety claims.

## Engineering constraints
- Do not interpret STL as having known units until confirmed.
- Existing service-load FEM and steady conduction are not metal-AM build thermomechanics.
- No system can guarantee prediction of every possible manufacturing failure.
- Always read fresh GitHub main / latest commits / open PRs before editing; preserve teammate work.
- Definition of done includes npm test, npm run typecheck, npm run build and Playwright desktop/mobile evidence plus deployment verification.

## As-built behavior (2026-10-29)
- `/` offers the initial chat composer and local STL attachment.
- `/copilot` is the primary chat + 3D geometry + visible analysis activity workspace.
- `/copilot/advanced` preserves the earlier five-stage engineering copilot, document evidence review and separate numerical studies.
- The build-height animation clips the **actual geometry** as a visualization, not a generated slicer toolpath or thermal process simulation.
- Failure findings currently come from mesh topology and geometric orientation screening. Physical print defect probabilities remain *not assessed*.
- ARC is not configured in the new primary chat. A user-facing local-guide label prevents interpreting this deterministic guidance as model output.

## 2026-10-29 continuation — numerical worker integration
- The primary chat exposes a collapsible engineer-approved numerical service study that reuses the existing UnifiedServiceStudy workers and job provenance ledger. AI text cannot authorize a run.
- The two existing real workers calculate original-part isotropic linear-elastic service-load stress/displacement and independent steady conduction. Result cards display MPa, mm and degrees Celsius, with optional calculated 3D fields.
- Calculated fields remain in original STL coordinates; orientation rotation and build-height clipping are disabled while a service contour is selected.
- Stale numerical results are hidden when STL hash, unit scale, process, or reviewed input assumptions change.
- The failure-coverage taxonomy distinguishes geometric screening, service calculations and print failure mechanisms that are not assessed. No service solve is rebranded as print-process prediction.
- The legacy engineering document review remains available at /copilot/advanced.
- Next: verified machine/material parameters, validated LPBF scan/deposition thermal physics, calibrated defect prediction, and physical benchmark comparisons. Never fabricate defect probabilities from geometry alone.

## 2026-10-29 — LPBF transient heat-flow research milestone

- Implemented a separate browser worker using finite-volume solid heat diffusion on activated, geometry-dependent thermal voxels.
- Engineer reviews nominal laser power, speed, hatch, physical layer thickness, retained energy fraction, recoating, material properties, plate and ambient boundary conditions. Inputs are illustrative until independently verified.
- Worker emits real progress, coarse thermal snapshots, numerical energy-balance diagnostic, warnings for exceeding solidus, and surface-mapped temperature fields displayed in the chat 3D model.
- Layer animation and temperature timeline are *virtual thermal slabs*, NOT true deposited-layer laser path, melt-pool dynamics or calculated print-defect probabilities.
- Updated risk coverage distinguishes a computed unvalidated LPBF heat-flow research study from validated scan-path thermal history, distortion, porosity and cracking, which remain **not assessed**.
- Tests verify energy conservation, two-cell conduction flux, zero-source equilibrium, positive coupled energy, solidus validity and browser consent/staleness behavior.
- Technical method and validation plan: docs/LPBF-TRANSIENT-RESEARCH-VALIDATION.md.
- Next engineering milestone: real scan-path heat source, temperature-dependent conductivity and heat capacity, latent heat/phase changes, measured benchmark comparison and mesh/time-step convergence. A credible defect model requires calibrated labeled outcomes; do not infer probabilities from this prototype.

## Imported scan-path CSV interchange milestone

- The experimental LPBF enthalpy worker accepts an explicit bounded ordered laser scan command plan from user-supplied UTF-8 CSV, separate from the generated serpentine demonstration raster. Required columns: slab,x0_mm,y0_mm,x1_mm,y1_mm,power_w,speed_mm_s.
- Segments specify coarse zero-based thermal voxel slabs in original STL X/Y millimeters, **not physical printed layer IDs**. Laser-off travel (power=0) advances time without laser deposition. Every virtual slab must be covered.
- Geometry/continuity validation rejects out-of-bounds paths, discontinuous path teleportation without travel, disconnected solid, powered laser exposure away from solid voxels, nonfinite settings, oversized inputs and unsafe solver-step counts.
- Browser computes SHA-256 of the uploaded CSV; the exported thermal research record stores filename, byte hash, number of segments, solver version, approved assumptions and numerical energy accounting. Source CSV itself must be retained by the engineer.
- A path-preview component shows source scan tracks by slab (orange laser-on and dashed gray laser-off) as a scaled 2D diagram, explicitly *not* a registered STL overlay or proof of machine execution.
- A public, non-sensitive reproducibility example is included: public/verification/cube-10mm-research-scan.csv for the 10-mm cube STL at millimeter units and voxel resolution 6.
- Numerical and Playwright tests verify parser rejection, bounds, continuity, commanded power energy accounting, upload/hash, simulation, results invalidation, and path review.
- NIST AMB2022-01 offers layer-wise detailed HDF5 scan records. Native HDF5, machine scan file parsing, calibrated thermal measurements, validated powder conductivity, and true physical-layer mapping remain future work. See docs/LPBF-TRANSIENT-RESEARCH-VALIDATION.md.

## 2026-10-29 numerical sensitivity diagnostics

- The approved experimental LPBF process-thermal chat card exposes a separate **Run numerical sensitivity checks** action. It runs in an independently cancellable and bounded browser worker, and verifies the uploaded STL bytes against the active part SHA-256 before comparison.
- A time-step refinement repeats the same part, inputs and generated/imported source path with half the maximum explicit time step. The actual run differences in peak temperature, final mean temperature, RMS of final surface-projected temperatures, energy and solver steps are reported.
- A generated-raster study also *attempts* a bounded spatial sensitivity study at resolution +2. Because this changes the discretized source and virtual layer aggregation, it is **not** a controlled grid-convergence result.
- Imported CSV scans intentionally **disable spatial refinement**: their ordered virtual-slab indices cannot simply be reused with a different voxel resolution.
- Missing/unsafe solver runs are reported as skipped with reasons, rather than synthesized or labeled passed.
- Engineer can download a numerical sensitivity JSON record with exact part hash, model version, approved inputs, optional original scan-file hash, time-step parameters, computed outputs and limitations.
- The numerical comparison **does not constitute physical validation or manufacturing defect prediction**. NIST AMB2022-01 remains a future validation target for calibrated laser/thermal physics, layer coordinate mapping and benchmark uncertainty. See docs/LPBF-TRANSIENT-RESEARCH-VALIDATION.md.
