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
