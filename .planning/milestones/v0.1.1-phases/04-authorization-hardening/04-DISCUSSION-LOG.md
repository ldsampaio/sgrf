# Phase 04: Authorization Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-24
**Phase:** 04-Authorization Hardening
**Areas discussed:** Vote visibility, Request scoping, Cancel & remove rules, Deny style & limits

---

## Vote visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Council + leaders | Conselheiro, chefe and admin see voter + value; others see tally only | |
| Leaders only | Only admin/chefe see identities; council members see tally only | |
| Real-time / full detail / same-as-council | Votes not secret; visible as cast; owner sees full detail; non-voters see same as council | ✓ |

**User's choice:** everyone, vote is not secret; Real-time; Full detail (owner); Same as council (non-voters)
**Notes:** Full transparency is a deliberate product stance. listVotes enforces view-scope, not voter-role.

## Request scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Own + in-voting (PROFESSOR) | Own requests plus any under vote; others' drafts/rejected hidden | |
| Everything non-draft (PROFESSOR) | All requests except others' drafts | ✓ |
| No drafts (CONSELHEIRO) | Drafts visible only to owner + admin/chefe | ✓ |
| Strict owner-only (ALUNO) | ALUNO sees only own requests | |
| ALUNO = PROFESSOR | ALUNO sees everything non-draft | ✓ |
| Same as view (amounts) | Anyone who can view sees amounts | ✓ |

**User's choice:** PROFESSOR everything non-draft; CONSELHEIRO no drafts; ALUNO same as PROFESSOR; amounts follow view
**Notes:** ALUNO parity explicitly overrides docs/06 matrix row "Visualizar pedidos em votação: Não" — planner must update the doc, not implement the old cell.

## Cancel & remove rules

| Option | Description | Selected |
|--------|-------------|----------|
| Owner + leaders (cancel) | Owner cancels own drafts; admin/chefe can cancel any non-approved request | ✓ |
| No justification | Draft cancel trivial, audit only | |
| Justification required | Same discipline as after-approval path | ✓ |
| Author + admin + chefe (remove) | Chefe also moderates discussion | ✓ |
| No window (remove) | Remove anytime; audit preserves record | ✓ |

**User's choice:** Owner + leaders; Justification required; Author + admin + chefe; No window
**Notes:** None.

## Deny style & limits

| Option | Description | Selected |
|--------|-------------|----------|
| 403 role, 404 scope | 403 for wrong role; 404 when resource outside caller scope | ✓ |
| Own-scope events (chefe audit) | Chefe sees audit for in-scope requests/users, not system-wide | ✓ |
| Everyone views transactions | Everyone can see, only leaders edit | ✓ |
| Keep both (force-reset) | Admin + chefe, chefe blocked from targeting admins | ✓ |

**User's choice:** 403 role / 404 scope; own-scope audit; transactions view-open + edit-locked; force-reset unchanged
**Notes:** Transactions view-open differs from current controller code (leaders-only view) — view gate must be loosened.

---

## Claude's Discretion

PERMISSIONS map key shape and ownership-helper placement; supertest DB story (mock Prisma vs test Postgres) spiked at plan time.

## Deferred Ideas

None — discussion stayed within phase scope.
