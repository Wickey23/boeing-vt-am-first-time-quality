# Source-linked service input approvals — engineering workflow

This first increment bridges **document evidence** and **original-part numerical service inputs** without claiming automatic requirements interpretation or aerospace qualification.

## Supported scope

1. Upload and confirm the target STL, then attach plain-text / DOCX / XLSX context.
2. In Documents, review a source passage and write why it applies to the actual part. Reviewing relevance does **not** approve the numerical input.
3. In Requirements, **Link reviewed evidence to solver inputs** displays conservative candidates for numeric forces in N/kN, Young's modulus in MPa/GPa, and Poisson ratio.
4. For a force, explicitly select the original-part X/Y/Z axis **and positive/negative direction**. Review the number, units, source uncertainty, and applicability.
5. Write an independent review rationale and check the numerical confirmation. Only then can the source-normalized value update the active service case. Manual, independent entry remains available.
6. The service analysis requires its existing separate confirmation of the **entire** load/material/thermal/fixture assumption set. The numeric mapping does not approve the simplified end-face clamp or the full simulation.
7. The job ledger freezes approved current source-to-input mappings, the case values, reviewed passages, and solver outputs. Changing the passage or input after review causes the mapping to show as stale and excludes it from new jobs.
8. The engineering review PDF and portable project JSON include the source-linked numerical history. The PDF includes only currently applicable mappings.

### Strict boundaries

- A phrase such as "500 N axial load" does **not** establish which original STL axis or sign is intended. The engineer must choose.
- An explicitly unverified, estimated, or draft document value is flagged. It may be used for a research example only after separate engineer confirmation of the magnitude, units and applicability; it is not a qualified specification.
- Source parsing is conservative and excludes torque/moment expressions from force extraction. It does not attempt to resolve physical force directions from text, load combinations, distributed loads, contact, fatigue, material allowables or attachment surfaces.
- The structural worker remains isotropic, linear elastic and subject to an idealized whole-end-face fixture. A computed stress is not a strength margin or first-time-quality probability.
- Source text and source review are stored in the browser. This prototype is not approved storage for confidential Boeing/export-controlled data.

### Verification

- \`tests/engineering-parameter-binding.test.ts\` checks unit conversion, axis confirmation, uncertainty, source revision invalidation, parameter-type restrictions and job-ledger consistency.
- \`tests/browser/copilot-parameter-provenance.spec.ts\` covers reviewed source → signed force → actual numerical worker → exported job provenance → source edit → stale mapping.
- Prior numerical, workflow and process-specific tests remain required before deployment.

### Next engineering capabilities

Use the part's actual CAD assembly to map loads and fixtures to selected geometric surfaces. Follow with qualified process/material datasets and independently validated thermomechanical print simulations. Secure multi-user project access and approved external AI require an organizational authentication and information-handling decision before enabling.
