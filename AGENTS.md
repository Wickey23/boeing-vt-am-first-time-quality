# ORIENTAI collaborative development instructions

These instructions apply to anyone using an AI coding assistant or automation to modify this repository. ORIENTAI is a shared Virginia Tech engineering project. **Never assume repository state from a previous conversation or session.**

## Mandatory pre-work audit — before any modification

1. **Read the latest remote state**, not a cached summary:
   - Identify the repository default branch, current `main` commit SHA and its timestamp.
   - Review at least the newest 10–15 commits, commit authors, and changed file paths. Compare `main` to the last commit you previously inspected, if known.
   - List **all open pull requests** and active feature branches. Inspect titles, head/base SHAs, affected files, mergeability and any relevant reviews.
   - Compare the branch you intend to work on against current `main`, including `ahead_by`, `behind_by`, and files modified. A stale open PR is **not** an accepted implementation.
   - Read current source files, tests and docs for the precise feature you will change; do not reconstruct code from conversation memory.
   - Check the most relevant recent CI and deployment statuses before assuming something is working.
2. If working in a local checkout, first inspect `git status --short` and `git branch --show-current`. **Preserve unstaged and uncommitted teammate work**; never reset, clean or overwrite an unreviewed worktree.
3. Give the user a short pre-work audit: `main` SHA, relevant changes since the last work, open PRs, likely file conflicts, and what branch/work you propose.
4. Only then edit. Start from the **freshly inspected `main` SHA** on a dedicated descriptive feature branch or a properly reconciled existing branch. Never start from an outdated remembered SHA.

Git CLI reference when available:

```sh
git status --short
git branch --show-current
git fetch origin --prune
git rev-parse origin/main
git log -15 --date=iso --pretty='%h %ad %an %s' origin/main
# Use the actual previously-reviewed SHA, if one exists:
git diff --name-status <previous-reviewed-sha>..origin/main
gh pr list --state open --limit 50
gh pr view <pr-number> --json title,headRefName,baseRefName,files,reviewDecision,statusCheckRollup
git switch -c feature/<descriptive-name> origin/main
```

For GitHub connector-only sessions, use current GitHub repository/branch/commit/PR endpoints and compare-commits tools instead. Do not claim a local `git status` was run if you only inspected remote GitHub.

## Protect team work while coding

- Respect all changes already merged into `main`. **Never reset or force-push `main`, silently revert teammate UI/features, or directly replace an entire large shared file from an old copy.**
- Identify overlapping edits in `app/page.tsx`, `app/orientation/*`, `components/v2/AppShell.tsx`, `components/AnalysisProvider.tsx`, analysis/model libraries, test suites, and reporting. These files have been edited by multiple contributors.
- Prioritize small, isolated commits, readable diffs, compatibility and reuse over unnecessary rewrites.
- For a concurrent PR touching the same files, inspect its exact diff and coordinate design/integration decisions rather than cherry-picking its entire branch or discarding it.
- Preserve existing user projects and service-load data; migrations must have backward-compatibility and regression checks.
- Treat `CHANGE_TICKER.json` as a **code-commit counter, not a synchronization or freshness oracle**. It does not replace checking commit history, open PRs, branch SHA and diffs.
- Do not commit confidential, proprietary, export-controlled, customer-owned or unapproved aerospace CAD/drawings/datasets.

## Mandatory pre-merge recheck

1. Immediately before proposing or merging, **fetch `main` again**, compare the current head and the feature branch, and review newly arrived commits and conflicting paths.
2. If `main` changed, merge/rebase deliberately and resolve each conflict using both contributors' intentions. Re-read any shared files and repeat relevant tests. Do not overwrite a newer modification.
3. Run the available acceptance gates: `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` (plus relevant feature-specific checks). Report what actually passed and what was not run.
4. Use a pull request with a summary of the change, touched features, compatibility risks, test evidence and any unresolved overlap. When shared high-conflict files are involved, request human review instead of automatically merging.
5. After merging, verify the merge commit SHA and deployment status before claiming the application is live.

## Engineering evidence requirements

- Distinguish geometric orientation screening from real support slicing or machine feasibility.
- Distinguish illustrative DED teaching paths and deterministic queue examples from real uploaded-part toolpaths and Simio runs.
- Distinguish service-load FEA and steady heat conduction from validated deposition thermal history, residual stresses, distortion, defect probabilities and first-pass/flight qualification.
- Do not fabricate machine settings, material allowables or aerospace approval. Keep numerical inputs, provenance, limitations and result identity attached to the correct part/process.

## Definition of a good handoff

At the start: latest `main`, new changes, active PRs, overlap risks, and chosen feature branch.

At the finish: changed files/features, test results, PR link, whether merged, deployed commit/status, and outstanding engineering limitations.

**Note for concurrent work:** GitHub Actions may add a change-ticker commit after a successful merge. Include that bot commit in the fresh main-SHA audit; it is not evidence that another feature has changed until the diff confirms it.
