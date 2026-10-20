# Guided workspace release

The part workspace now separates local mesh inspection from orientation optimization. Upload opens a geometry review and source-unit check; a dedicated worker computes dimensions and topology without running orientation search. Users confirm dimensions, choose manufacturing priorities, and explicitly start the search. Changing inputs clears the prior run; it does not silently run new calculations. Existing schema-1 saved workspaces, named revisions and portable projects remain supported.

Results lead with the selected candidate, measured changes relative to O01 (the uploaded orientation), and clearly qualified estimates. Focused sections reveal distinct alternatives, the full candidate table, actionable geometric concerns, optional studies, and saving/reporting. Down-facing warnings can turn on the actual calculated surface overlay. Other warnings remain unlocated when no spatial finding exists. Comparison camera presets are linked; free orbit and zoom remain independent.

Physical studies retain existing numerical models, property review, boundary schematics, topology blocking and mesh-sensitivity checks. They are progressively disclosed, not new physical models. Restoring a project preserves fields but requires geometry confirmation before new physical studies. The opening sample library offers original educational models and STL downloads; symbols identify categories rather than claiming to preview the precise mesh.

Verification targets: the existing 22 numerical/data tests plus browser coverage of guided gating, units, explicit reruns, saved revisions, both physical solvers, report downloads, all teaching meshes, and mobile layout. No teammate usability acceptance or validated manufacturing prediction is claimed.
