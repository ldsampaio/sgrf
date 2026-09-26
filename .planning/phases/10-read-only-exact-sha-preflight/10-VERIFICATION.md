# Phase 10 Verification — Read-Only Exact SHA Preflight

## Status: passed

**Phase:** 10-read-only-exact-sha-preflight  
**Milestone:** v0.1.2 — GitHub Release Reliability  
**Verified:** 2026-09-25

## Plans executed (8 of 8)

| Plan | Artifact | Status |
|------|----------|--------|
| 10-01 | tools/release-close/gh-client.js — 6 real `gh api` methods | ✅ |
| 10-02 | tools/release-close/classify.js — failedRunIds from ci.records | ✅ |
| 10-03 | tools/release-close/release-close.js — verify wired, --fixture, input validation | ✅ |
| 10-04 | tools/release-close/fixtures/live-baseline.json + gh-client.test.js | ✅ |
| 10-05 | tools/release-close/verify.test.js — full verification suite | ✅ |
| 10-06 | tools/release-close/integration.test.js — end-to-end CLI | ✅ |
| 10-07 | README.md + STACK.md + INTEGRATIONS.md + 10-07-SUMMARY.md | ✅ |
| 10-08 | This document | ✅ |

## Requirements traceability

| Requirement | Evidence |
|-------------|----------|
| REL-01 | gh-client.js uses `gh api` via `execFile` (no shell, no injection) |
| SAFE-01 | `release-close.js` verify rejects invalid version/sha before any remote read |
| SAFE-03 | `classify.js` derives failedRunIds from ci.records, not stray keys |

## Test results

- `node --test "tools/release-close/*.test.js"`: **228 tests, 0 failures**
- Integration tests: 4/4 pass (real gh CLI + --fixture)
- Snapshot tests: 6/6 pass (fixture shape + classifier contract)

## Must-haves verified

1. ✅ Live baseline fixture encodes verified live state
2. ✅ Snapshot tests prove fixture shape matches contracts
3. ✅ Historical red run recorded as "ignored" by construction
4. ✅ verify reports tag, main, CI, Release, Milestone explicitly
5. ✅ mutations: 0 on every verify output
6. ✅ --fixture flag activates fake client
7. ✅ Input validation rejects invalid version/sha
8. ✅ No write methods on ghClient
9. ✅ No env token reads in ghClient
10. ✅ 404→null in all read methods
11. ✅ All 214 original tests still pass
12. ✅ Evidence tests updated for new classifier behavior
13. ✅ Safe04 tests updated for new JSON structure
14. ✅ Eligibility tests updated for new CLI interface
15. ✅ Integration test with real gh CLI passes
16. ✅ Integration test with --fixture passes
17. ✅ Documentation updated (README, STACK.md, INTEGRATIONS.md)
18. ✅ No credentials in any artifact
19. ✅ Live baseline fixture has no credentials
20. ✅ Codebase maps refreshed
21. ✅ Operator runbook notes in README
22. ✅ Phase verification document created

## behavior_unverified: 0
