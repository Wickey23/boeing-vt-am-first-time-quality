# Team-Review Preview — User Acceptance Checklist (2026-10-12)

## Exact scope
Research prototype: CAD STL upload or synthetic sample -> triangle-mesh inspection -> material/process screening -> illustrative rectangular build envelope -> export JSON or browser print/PDF.
No native STEP/3MF geometry parsing, no general-part structural FEA, no real support computation, no thermal simulation, no printer control, and no qualification.

## Tested by automated build
- Vercel Next.js compile, TypeScript validation, and generation of pages (at commit 95f76f5).
- Earlier synthetic mounting-plate geometry independently checked with trimesh: watertight, winding-consistent, 512 triangles, 80×50×8 mm, volume approx 30946.98 mm³. This was an offline reproduction of the generator's algorithm, not an end-to-end browser assertion.
- Latest state-safety change requires its own Vercel build to confirm.

## Manual smoke test before sending
1. Open the PREVIEW /workspace route (do not use production/main).
2. Verify sidebar/form layout is well spaced at 1440px and mobile width; no horizontal overflow.
3. Click **Load sample mounting plate**; expect a rendered 3D mesh and positive numbers with X=80, Y=50, Z=8 mm, triangle count 512, and closure estimate LIKELY.
4. Orbit/zoom/pan model and press **Reset view**; model should fit and reappear.
5. See Preliminary AM screening populated with clearly labeled heuristic concerns.
6. Check example 200×200×200 mm envelope; expect 6 of 6 axis-aligned permutations fit. Change envelope X to 5: some or all must show OUTSIDE.
7. Press **Continue to geometry**; scrolls to calculated geometry metrics (does not imply a generic FEA step).
8. Change material/process; AM result should invalidate. Press **Run geometry/process checks** to refresh.
9. Enter project name, a load, and notes. Refresh. They should remain in this browser; the CAD file must be reselected.
10. Press **Download JSON** and verify project, geometry, chosen units, material/process, limitations, and source SHA-256.
11. Press **Print / Save PDF** and confirm clean research summary.
12. Choose a STEP/3MF file (only approved, non-sensitive sample). Expect an explicit parser-unavailable message and no fabricated geometry.
13. Choose an invalid or empty STL file and verify an error is shown rather than stale metrics.
14. Verify public preview contains NO controlled, proprietary or export-controlled Boeing data.

## Known limitations and release criterion
A Vercel READY build verifies compilation/deployment but not 3D browser behavior. Do not mark team-demo QA complete until sample and controls pass in a browser. The current Next.js version should be upgraded to a supported patched release before any security-sensitive deployment; production/institution-approved data handling is not configured.

## Source
Branch: feature/team-review-demo-20261012
Use a Preview deployment; do not promote to production without team review.
