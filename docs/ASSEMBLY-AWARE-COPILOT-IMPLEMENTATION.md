# ORIENTAI Assembly-Aware Engineering Copilot — First Integrated Slice

## Goal
Upload **the target STL** and **references describing the surrounding assembly**, interview an engineer about component identity and interfaces, retrieve source-backed engineering excerpts, and execute the existing deterministic analysis tools with status/provenance — without pretending that a language model has solved a physics problem.

## Routes and source of truth
- New primary entry: \`/copilot\` (homepage main action and Projects first card; team landing-page design retained)
- Legacy guided numerical screens remain at \`/orientation\` and \`/orientation/advanced\`, using the same \`AnalysisProvider\` geometry, orientation run, material identity and service cases.
- The copilot uses an additional **part-scoped local browser knowledge record** keyed by SHA-256 of the STL bytes (or explicit \`ded-example\`). If the uploaded part changes, its contextual notes and document excerpts are not assigned to the new part.
- Each source has a stable document ID \`D1, D2, ...\` and an extraction state. Source matching produces \`[D1 L1–L4]\`-style excerpts only for text actually available. Engineer-entered excerpts are labeled separately.
- The user can export a JSON research-context record that **excludes binary STL and uploaded document bytes**. This is separate from the existing full STL project-backup feature.

## Source upload limitations and honest handling
- Local extraction supports `.txt`, `.md`, `.csv`, `.json`, `.log`, `.docx` and the first worksheet of `.xlsx`. DOCX references retain paragraph labels; XLSX references retain row/cell labels.
- PDFs, legacy DOC/XLS, scanned drawings, and native CAD assemblies are **not** automatically parsed locally. Engineers can paste relevant excerpts and page references into the source panel.
- At most 12 sources, each up to 3 MB; only up to 30,000 characters of locally extracted text per source are saved.
- If external AI mode is enabled, the engineer may explicitly opt in to transmit reference excerpts and optionally **reattached** PDFs (at most 2 PDFs up to 2 MB each) to the AI service. Do not claim page-level PDF citation unless the model returns it and engineers verify it. PDF binaries are NOT kept in localStorage and must be reattached after reload.
- Entire native CAD assemblies / STEP are not parsed. Explicit part-to-assembly coordinate mapping and mesh-face semantic attachments are future engineering work.


## Source-to-requirement review (October 2026)
- The copilot now has a dedicated **Review source-backed engineering evidence** section. It looks for literal passages about loads, mounting, material, tolerances, inspection and assembly relationships from locally available source text. This is keyword classification, **not model inference**.
- A candidate displays a source identifier, location (text line, DOCX paragraph, XLSX row, or engineer note), the original excerpt and an explicit caution if it contains uncertainty language.
- An engineer must open the candidate and enter a short rationale before the passage is recorded as reviewed. This validates the engineer's stated relevance, **not the factual correctness, source authenticity, material property, or solver applicability**.
- Each reviewed reference records a local source-content revision. Changing its source text or engineer notes, or removing the source, marks the old review **stale**. Stale citations are displayed for correction but excluded from new job snapshots.
- A new simulation job freezes exact current reviewed passages, their reviewer notes and location labels alongside the approved numerical input snapshot. It does **not** automatically set forces, fixture boundaries, elastic constants, thermal conditions or acceptance criteria from document text.
- Previous `schema:1` browser project-context records restore with an empty reviewed-evidence list (no data migration required).
- All extracted document data, reviewed snippets and study records remain **local browser data**, not a secure shared engineering database. Avoid importing restricted or proprietary drawings without approved handling.

## Engineering chat modes
### Local engineering guide — runs without a model
- Asks for STL confirmation, part role, assembly location, mounting and loads, material/requirements and next supported solver.
- Searches actual attached text/excerpts and cites document IDs.
- It is deterministic workflow assistance, **not AI reading or understanding PDF drawings**.

### Optional external AI interview
- \`/api/engineering-copilot\` is a bounded, server-only AI Gateway integration. The browser NEVER receives API keys.
- \`AI_COPILOT_ENABLED=true\` must be configured explicitly, and Vercel's \`VERCEL_OIDC_TOKEN\` or a provisioned \`AI_GATEWAY_API_KEY\` must be available. A vetted model can be set via \`AI_GATEWAY_MODEL\`; the default currently references a verified AI Gateway catalog identifier \`openai/gpt-6-luna\`.
- The user must actively tick a consent attestation for **each session** before invoking the remote endpoint. No automatic upload or AI request occurs on part/document import.
- Do **not** enable external AI access on a public, unauthenticated engineering prototype until the team has implemented per-user auth, durable quotas, rate limiting, spend budgets and information-handling approval. The current process-local budget is best-effort only, NOT a robust security control.
- No remote provider calls run when disabled; the UI displays the reason and retains local guidance.
- The model is prompted to treat documents as untrusted reference data and not to invent forces, qualification, simulation execution, material properties, part locations or unsupported accuracy.
- Responses are explanations/questions, **not trusted machine instructions or executable solver tool calls**.

## Simulation execution
- The existing local orientation worker is run from an explicit copilot button only after STL dimensions/units are confirmed and process is LPBF. The UI displays progress, real candidate IDs, build heights, support proxy and envelope check.
- Existing service FEM and steady-conduction panels can be opened and executed with their own validated boundary-condition approval controls; those are the same real calculations as the guided workbench.
- The copilot does NOT claim it ran transient deposition thermal, residual stresses, distortion, calibrated fatigue/yield models or first-time acceptance probability.
- The standalone DED teaching wall remains an explicit separate example; arbitrary uploaded-part DED toolpath execution remains unsupported.

## Privacy and correct usage
- Browser localStorage and IndexedDB are not a secure repository for restricted Boeing CAD, ITAR/EAR-controlled technical data or sensitive proprietary drawings.
- The application must never send part geometry or reference documents to an external model without explicit authorization, approved data classification and the institution/client's security requirements.
- The local documentation store contains only extracted text/excerpts; no raw PDF or STL geometry is transmitted to the model by default. Opt-in mode may transmit source excerpts and attached PDFs, as described above.

## Recommended next release gates
1. Test engineering chat with non-sensitive public example documents and intentionally contradictory snippets.
2. Add authenticated identity, durable quotas and spend limits before allowing public external AI requests.
3. Add robust **local** PDF/DOCX/assembly drawing extraction with page-level provenance, not just file metadata.
4. Build formal source-to-parameter engineer approval (material properties, loads, boundary regions, CTQs) rather than parsing text into solver parameters automatically.
5. Add physically calibrated orientation-dependent material/property modeling and DED deposition planning with appropriate independent validation.
6. Build a persisted simulation-job DAG with cancellation/retry and a coherent single report that links exact source snapshots, model revisions and physical evidence.

## QA
- Unit tests cover part isolation, source references, PDF extraction honesty, prompt sequencing and caps.
- Browser tests cover the new homepage → copilot → real STL → source attachment → cited local guide → actual orientation worker, and explicit remote-model authorization.
- Existing LPBF and DED guided browser tests have selectors updated for the team's revised landing-page copy.
- Run \`npm test\`, \`npm run typecheck\`, \`npm run build\`, \`npm run test:e2e\`; review fresh main/PR diffs again before merge.
