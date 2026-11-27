---
feature: M01 study identity and recovery
source_main_sha: 9682f2c7b5e2a1ce400f891a2147a1f1908c7923
date: 2026-11-25
review_kind: code-inspection
evidence_status: observed
---
# User and task
Restore or transfer a prior assessment while retaining the correct part and inputs.

# State and evidence map
Stored result -> hash/configuration/run verification -> current result, or archived recovery snapshot plus cleared active result and rerun instruction. Portable export -> verification -> manifest; incompatible imports reject before replacing the active study. A manifest proves input consistency, not engineering validity or authenticity.

# Findings and repairs
S1: local restore previously accepted a hash-shaped string without comparing bytes/configuration. Shared validation now verifies both and preserves a recovery copy. Tests cover changed units and part hashes.
S1: export could package stale results. Export now checks identity, selection and attached runs; import checks the optional manifest. Legacy files without manifests still undergo identity checks.
S2 remaining: recovery copies are preserved in IndexedDB but have no dedicated recovery browser. Full historical revision UI remains in the execution backlog.

# Accessibility and user evidence
Existing role=alert carries the recovery message. No new interactive controls. Manual keyboard, screen-reader, mobile and participant studies NOT TESTED. No WCAG or usability-study success claimed.

# Scientific interpretation
Manifest explicitly states calculated-unvalidated and physical validation not established. No defect labels or build qualification are inferred.

# Verification
Targeted identity/transfer/service tests and full numerical suite pass. Browser and release results are recorded in the completion plan after execution. See the historical milestone tracker for M01 and the authoritative execution plan for current status.

Final local verification: 206 numerical/unit tests, 82 browser tests, 5 Python tests, TypeScript and production build passed. Recovery alert and retained archived run were asserted in Chromium. Human accessibility and participant validation remain open.
