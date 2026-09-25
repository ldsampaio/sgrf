---
phase: "09"
slug: "release-close-contract-fixtures"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-25"
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator → CLI argv | Untrusted repository, version, and SHA values enter the release-close tool | Opaque strings validated by pure contracts |
| fake-client → pure logic | Frozen fixture evidence crosses into eligibility and classification | Versioned JSON and normalized read results |
| operator → gh stub | Any premature live-client call must fail closed | Method name only; no credentials or remote data |
| operator TTY → apply gate | A human confirmation crosses the mutation fence | Visible eight-step plan, `--yes`, live TTY, typed `sim` |
| tool output → terminal/logs | Text and JSON evidence may later enter runbooks | Decisions, frozen SHAs/run IDs, and `mutations: 0` only |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | `release-close.js` argv handling | high | mitigate | No subprocess exists; metacharacter values are tested as opaque strings in `eligibility.test.js`. | closed |
| T-09-02 | Tampering | `fixtures/reference.json` | medium | mitigate | Full-lowercase-40-hex validation and strict equality are executable; canonical tag, commit, and run IDs are frozen in fixtures. | closed |
| T-09-03 | Information disclosure | CLI output | medium | mitigate | Source and captured-output tests reject credential shapes and credential environment reads. | closed |
| T-09-04 | Tampering | `fixtures/*.json` | high | mitigate | Six state fixtures use canonical values; all seven write actions are null; `nowrite.test.js` scans the non-test source for forbidden write/ref surfaces. | closed |
| T-09-05 | Elevation | `gh-client.js` stub | medium | mitigate | All five methods throw and name Phase 10; `nowrite.test.js` asserts each throw. | closed |
| T-09-06 | Repudiation | scripted fake sequences | low | accept | Ordered call log asserts ref → tag object → main → release → milestones; live ordering is deferred to Phase 10 preflight. | closed |
| T-09-07 | Elevation | `apply-gate.js` | high | mitigate | Tests pin missing flag, missing TTY, wrong answer, full-lock confirmation, and visible-plan-before-prompt ordering. | closed |
| T-09-08 | Information disclosure | verify/plan/apply JSON and text | high | mitigate | `safe04.test.js` scans implementation sources and captured command output for credential-shaped material. | closed |
| T-09-09 | Tampering | ordered close plan | medium | mitigate | Eight recovery steps are fixed and tested in the required Release draft/readback/publish/readback/Milestone open/readback/close/final-readback order. | closed |
| T-09-SC | Tampering | package supply chain | high | mitigate | `tools/release-close/package.json` is private ESM with no dependencies or install step; Node stdlib tests run directly. | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-09-06 | T-09-06 | Scripted evidence cannot prove live GitHub ordering; this is intentionally deferred to the Phase 10 read-only preflight and later live recovery. | Phase 9 plan | 2026-09-25 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-25 | 10 | 10 | 0 | GSD L1 artifact audit |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-25
