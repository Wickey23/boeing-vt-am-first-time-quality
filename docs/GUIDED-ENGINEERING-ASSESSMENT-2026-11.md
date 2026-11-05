# ORIENTAI — Guided Engineering Assessment (November 2026)

## Product objective
An engineer uploads a **part**, supplies approved documents describing the **assembly and service context**, confirms the interpreted requirements, runs appropriate **pre-build and service screens**, and exports a **traceable, evidence-limited failure assessment**. The goal is decision support toward first-time quality, **not** an asserted print success probability or aerospace approval.

## Product flow
1. **Part geometry** — import a target STL, verify units/dimensions, inspect watertightness and geometric flags, review candidate LPBF orientations, projected overhangs and conceptual supports. Keep the uploaded mesh visible through the study. When dimensions or part bytes change, invalidate stale results.
2. **Engineering context** — attach part/assembly specifications, drawings and requirements; extract local text where supported; show literal source and locator; capture part purpose, assembly interfaces, forces, directions, fixings, material, quality-critical surfaces, inspection and tolerance needs. The AI may propose *questions* and *possible interpretations*; the engineer explicitly confirms applicability and numerical inputs. Do not silently turn document text into solver input.
3. **Failure assessment and export** — distinguish manufacturability concerns from in-service failure modes, show which checks actually ran and which remain unassessed, rank actions based on supporting evidence rather than invented probabilities, localize source-linked geometry flags on the mesh, and export a versioned assessment with assumptions and traceability.

## Already implemented before this release
- Chat-first study, uploaded STL viewer, orientation and geometric preflight, conceptual support and layer buildup previews.
- Separate engineering copilot at `/copilot/advanced` with part-scoped local document store, DOCX/XLSX/plain-text extraction, engineer excerpts, evidence review, parameter binding approval, service analysis, engineering readiness and PDF/JSON export.
- Existing PDF documents register as metadata; **no automatic local PDF text or scanned drawing extraction**. AI Gateway is optional and requires separate explicit opt-in; public prototype is not approved for restricted customer data.

## Phase A: navigation and immediate context intake (first implementation)
- Expose three primary stages in `/copilot` without removing existing engineering capabilities.
- Offer part-scoped assembly/requirements upload in the visible main study.
- Reuse exactly the existing `addProjectSource`, `restoreKnowledge` and provenance storage contract; no second independent knowledge store.
- Make document and assessment stages deep-linkable into the existing engineer-review and export workspaces.
- Clearly distinguish extracted text, metadata-only PDF and reviewed engineering facts.
- Fix browser tests that still expect the removed duplicate layer-preview controls.

**Acceptance checks:** upload STL, confirm dimensions, attach a public TXT or DOCX, reload/switch to the document-review stage and retain the correct part reference; open the report stage without inventing an analysis. PDF attachment must explicitly say it requires excerpt/approved processing. No unexpected external AI call.

## Phase B: contextual engineering intake (next)
- Unify the five advanced subtasks into Stage 2 under collapsible **Documents**, **Requirements**, and **Approved solver inputs**.
- Introduce a typed `EngineeringRequirement` record: `id, category, originalText, sourceId, locator, normalizedValue?, units?, coordinateFrame?, interfaceGeometry?, certainty, reviewStatus, reviewerNote, revision`.
- Separate `extracted`, `hypothesized`, `engineer-confirmed`, `superseded` and `not-provided`. An LLM interpretation is never `engineer-confirmed`.
- Support source revision invalidation, conflict/contradiction flags, signed load directions and coordinate/frame confirmation. Track which uploaded STL region corresponds to fixture/load faces only when explicitly selected and reviewed.
- Add PDF text extraction with page locators in a separately validated, size-limited worker; scanned pages need approved OCR and human verification. Keep text extraction independent of authorization to transmit data to external AI.
- Secure handling decision is a prerequisite for any confidential/restricted Boeing documents.

**Acceptance:** benchmark documents with contradictory loads, missing units, uncertain language, conflicting editions and multi-part drawings cannot create silent solver inputs. Uploading a new STL cannot borrow another part's requirements.

## Phase C: evidence-bound analysis orchestration
- Construct a versioned study manifest linking `partSHA256`, units, process/material/machine, document revisions, approved requirements, model versions and assumptions to every run.
- Offer applicable screening methods automatically after engineer confirmation. Keep available deterministic LPBF geometry, part-service linear-elastic FEM, and steady thermal conduction separate from unsupported physical print outcomes.
- Track `not-run`, `running`, `screened`, `calculated`, `not-assessed`, `invalidated`, `failed` with input identity and user-readable next actions.
- Block or clearly qualify predictions requiring unavailable material data, build-direction allowables, calibrated thermomechanical simulation, real scan paths and test correlations.

**Acceptance:** changing unit scale, material, source revision, loads or process settings invalidates the appropriate dependent results; all numerical outputs are reproducible from explicit inputs.

## Phase D: actionable failure assessment
For each failure mechanism maintain:
- failure mechanism and category (`manufacturing` or `in-service`);
- localized mesh faces/region and traceable view overlay, *only when grounded*;
- evidence sources (STL measurement, source passage, reviewed input, or solver output);
- applicability/assumptions, methodology and model version;
- result (`flagged`, `screened`, `calculated`, `unassessed`), severity rationale, **not invented probability**;
- mitigation/verification action and remaining required evidence.

Coverage initially includes geometric support/overhang/islands and machine envelope; additional porosity, cracking, residual stress, fatigue, fit and strength claims need qualified process and service-specific evidence. Report explicit `not assessed` where necessary.

## Phase E: engineering deliverable
- Update the existing engineering review PDF to prioritize executive assessment, part and assembly identity, requirement traceability, build assumptions, per-mechanism evidence and limitations, risk-localization images when reproducible, comparative options, prioritized verification plan, and clear sign-off status.
- Provide PDF for readers and JSON/ZIP for deterministic provenance and team handoff.
- Never characterize unsupported results as numerical failure predictions or certified readiness.

## Cross-cutting release gates
Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`, including a public bracket/assembly sample. Existing PR #8 (production flow) and PR #9 (DED/Simio docs) are separate and must not be overwritten. For shared UI files require reviewer approval. Recheck `main` before merge and report CI, Vercel status, and remaining limitations.

## Current implementation status
Phase A is under development in `feature/guided-assessment-context-intake-20261105`. Remaining phases are **planned, not complete**.
