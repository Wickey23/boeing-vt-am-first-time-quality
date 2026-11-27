# ORIENTAI CAD/CAE application redesign

## Goal and product boundary
A coherent engineering workspace inspired by SOLIDWORKS and Onshape interaction patterns, not a replica of either vendor's branding, proprietary icons, parametric CAD kernel, or simulation capabilities. ORIENTAI is an STL-based research assessment system. Preserve exact evidence identity, source qualification, local persistence, AI consent, and export safeguards.

## Reference research
- [SOLIDWORKS interface overview](https://help.solidworks.com/2027/english/SolidWorks/sldworks/c_user_interface_overview.htm): command groups, feature tree, breadcrumbs, graphics area, heads-up camera tools.
- [Manager pane](https://help.solidworks.com/2026/english/SolidWorks/sldworks/c_management_panel.htm): alternate tree/properties/configuration views and docking.
- [PropertyManager](https://help.solidworks.com/2024/English/solidworks/sldworks/r_pm_overview.htm): contextual input, selection fields, explicit accept/cancel, keyboard and resizing.
- [Simulation study tree](https://help.solidworks.com/2022/english/SolidWorks/cworks/c_simulation_study_tree_interface.htm): study folders for inputs, mesh, fixtures, loads and results.
- [Simulation results tools](https://help.solidworks.com/2025/english/SolidWorks/cworks/c_Simulation_Toolbar_-_Result_Tools.htm): plot type, clipping, probe, compare, mesh visibility, animation and reports.
- [Onshape interface](https://cad.onshape.com/help/Content/Home/user_interface_basics.htm): context-dependent grouped toolbars, feature list, graphics, selections, errors, compact overflow.
- [Onshape document panel](https://cad.onshape.com/help/Content/Document/document_panel.htm): versions, comments, notes, advisor and task management as secondary document tools.
- [Onshape document tabs](https://cad.onshape.com/help/Content/Document/document_tabs.htm): bottom tabs for active documents and study artifacts.
- [View navigation and cube](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm): explicit camera orientation and fit.

## Unified design specification
Use a shared neutral CAD chrome; restrained blue selection; compact but readable text; grouped commands with labels/tooltips; persistent source part and status. Desktop: study tree on left, model canvas in the center, contextual property editor on right, document tabs below. On narrow screens use stacked panels and accessible navigation; do not hide evidence state. Retain the guided layout as a preference, not a second data model. Make the AI assistant contextual and secondary; never imply unvalidated analysis is a measured result.

## Route migration / acceptance
| Surface | Implementation or next work |
|---|---|
| / | Study manager, import, benchmark and resume actions; optional question |
| /copilot/workbench | Model-first CAD default, command ribbon, study-tree navigation, tabs, right-side editor; refine tree hierarchy, visual fit, viewport legend and tool discovery |
| /report | Existing redirect to assessment; retain evidence/report/export controls, design a dedicated report workspace only after identity regressions |
| /copilot/advanced | Shared application shell; migrate actual solver controls into contextual editor, preserving input approval and status |
| /orientation | Existing legacy research tools; migrate real controls into shared workspace after route audit |
| /simulation/benchmarks | Shared results design after route audit; separate reference and model outputs |
| /ml | Model experiment evidence, coverage, abstentions, and uncertainty; never present unvalidated scores as defects |
| /validation | Clearly separate synthetic, experimental and independent physical verification |
| /how-it-works | Technical documentation and help, consistent navigation |
| Other legacy routes | Inventory and migrate individually; no speculative feature buttons |

## Release gate
Exact-head typecheck, production build, existing workflow regression, CAD-specific browser checks at desktop/mobile widths, preserved report exports and persisted study, manual rendered preview on representative parts, production smoke on the correct Vercel deployment. Existing guided-layout-specific geometric assertions are kept in guided mode; CAD tests independently cover placement, resizing, preferences, stage selection, mobile and study navigation. First CAD/release runs found mobile control and compact risk-state visibility regressions; fixes require rerun. No unvalidated physics promoted. UI release PR is based on main, not the research or CTQ branches. A full CAD/CAE redesign is not complete until legacy and advanced routes are migrated and reviewed.
