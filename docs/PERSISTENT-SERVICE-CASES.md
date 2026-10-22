# Persistent service cases

Implementation increment after main 605ff8b.

- Versioned service plan is stored independently of orientation results in the active local workspace and project exports. Manufacturing edits clear results but preserve cases. Replacing the part resets cases.
- Up to eight named cases can be duplicated, selected, edited and removed. Each uses the existing original-part end-plane fixture and XYZ force model. No new fixture physics is implied.
- Structural results are retained per case within the current analysis run. Physical input keys and run/case identities reject stale completions. Editing one case invalidates only that case; renaming does not invalidate physics.
- Original-part isotropic fields can be viewed under any candidate rotation in the same run. This reuses a coordinate-invariant solution; it is not a new orientation-dependent strength calculation.
- Backups preserve unsolved draft inputs. Import validates draft structure separately from physical validity; solving still requires physical input validation and user review.
- Summary, JSON and PDF distinguish not-run, no displacement requirement, within-model-limit and exceeds-model-limit. Strength, fatigue and manufacturing acceptance remain not evaluated.
- Existing original-part single-case projects migrate to a one-case plan. Legacy build-frame calculations are not promoted to original-part results.

Verification: numerical/data regression tests cover preservation, migration, per-case invalidation, stale responses, duplicate IDs and portable unsolved drafts. Browser regression covers two cases, a solved case, manufacturing edits, rerun, backup and reload. Production build/type checks and CI browser checks are release gates.

Remaining: actual surface-region fixtures, general requirements/material evidence, conforming FEA, validated ML and manufacturing simulation remain in COMPLETION-PLAN.md. Each case must currently be reviewed/run individually. Local browser persistence is not a shared secure geometry vault.
