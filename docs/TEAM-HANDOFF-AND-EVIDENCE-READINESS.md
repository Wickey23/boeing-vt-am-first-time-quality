# ORIENTAI — portable engineering projects and evidence readiness

**Implementation:** Browser-local, integrated into `/copilot`. These capabilities do not constitute an authenticated cloud project system or aerospace qualification.

## Working handoff

1. Open **Part** and upload an actual non-controlled STL.
2. Confirm the dimensions and units and select LPBF/DED as applicable.
3. Add assembly references. TXT, Markdown, CSV, JSON, DOCX and the first XLSX worksheet support local text extraction; PDF and legacy Word/Excel are metadata or manually entered excerpts.
4. Review and approve relevant source snippets; enter the intended part role and connection/fixture information.
5. Optionally run supported numerical studies with engineer-approved assumptions. These are original-part, isotropic service FEM and steady-conduction studies; LPBF additionally provides geometric orientation screening.
6. Under **Part → Team project handoff**, click **Export complete project ZIP**. It includes `project.json` (actual STL bytes encoded in the existing legacy-compatible portable project schema, settings, selected candidate, service-case plan, and saved orientation study), `context.json` (part identity, source text/notes, reviewed citations and conversation), `manifest.json` (STL fingerprint, reference inclusion and per-document hashes), and **reference binary files still attached in this browser**.
7. A teammate imports the ZIP in **Part**. ZIP parsing is local and bounded. The import validates the STL SHA-256, each retained document's SHA-256, source IDs/metadata, supported project schema, basic configuration limits, and archive entry names before applying the restored state.

**Caveat:** Previously uploaded PDF/DOCX/XLSX file bytes are not currently retained after a browser reload. The project keeps extracted text, notes, metadata and citations locally, but a ZIP created after reload labels unavailable originals as **excerpt-only**. To include the original source binary, reattach it in the same session before exporting. Do not assume original document binaries are present merely because a source title remains visible.

**Privacy:** The import/export action doesn't call an AI provider or upload original files. The ZIP may contain the full STL and all included documents. Send it only through a channel your institution and partner have approved. Do not use this public research prototype for Boeing-controlled, export-controlled, proprietary or sensitive aerospace material without written authorization and approved infrastructure.

## Evidence-readiness assessment

**Results → What can this study support?** summarizes:

| Category | Condition reported as ready |
|---|---|
| Part | Target STL present and units confirmed |
| Assembly | Engineer has entered the component's role and assembly context |
| Requirements | Engineer has recorded interface and requirements text |
| Source provenance | At least one current reviewed excerpt linked to the uploaded part |
| Service studies | Actual current structural and steady conduction workers have returned results |
| Manufacturing | **Never a qualified pass.** LPBF geometry has only geometric candidate proxies; uploaded-part DED pathing, distortion and process thermal are unavailable |

The output explicitly identifies unknown/unsupported areas and proposes the next step. **Research-ready** does not mean airworthiness, strength qualification, printability, first-time manufacturing success or compliance with any material specification.

## Remaining prerequisites for the full product vision

- Real multipage/scanned PDF extraction with page citations, assembly CAD mapping, and selection of actual attachment/force surfaces.
- Proper verified material allowables and direction-dependent printed-property characterization.
- Process-specific transient thermomechanical solver and physical calibration/validation using experiments or public benchmarks.
- Secure organizational identity, access controls, encrypted cloud storage, retained uploads, durable simulation compute jobs and audit logs.
- An approved AI Gateway provider with authorization, budget/rate controls, and explicit engineering-data policy; external model chat stays disabled on deployments without such configuration.
- Reconciliation and reviewed integration of PR #8 (production flow) and PR #9 (process engineering documentation). Do not merge stale branches wholesale.

## QA

- `tests/engineering-team-bundle.test.ts` validates import/export, checksum tampering and notes-only references.
- `tests/engineering-readiness.test.ts` validates process-specific evidence status and safeguards against false manufacturing approvals.
- `tests/browser/copilot-team-bundle.spec.ts` tests real STL+document handoff from the browser.
- Existing numerical, source-evidence, interview and service-study tests are unchanged.
