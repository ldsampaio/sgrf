# Operator Runbook — SGRF Release Close

## Authentication & Permissions

- GitHub token with `repo` scope for private repos
- Token passed via `GH_TOKEN` environment variable
- Never hardcode tokens in scripts or configs
- Token must have `admin:org` for milestone operations

## Read-Only Preflight

Before any mutation, run the preflight:

```bash
release-close verify --version v0.1.1 --sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf
```

Expected output: `ELIGIBLE` with all 8 locks passed.

## Reviewed Plan

After preflight passes, review the plan:

```bash
release-close plan --version v0.1.1 --sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf
```

The plan shows the 8-step reconciliation sequence with modes (escrita/leitura).

## Explicit Apply Confirmation

To execute:

```bash
release-close apply --version v0.1.1 --sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf --confirm sim
```

The `sim` confirmation word is required. Without it, apply aborts.

## Safe Rerun

If a step fails or times out:

1. Check evidence output: `release-close apply --evidence`
2. Review the `nextAction` field for guidance
3. Re-run with the same `--version` and `--sha`
4. The reconciliation is idempotent — reruns are safe

## Partial-State Recovery

If the apply is interrupted (signal, crash, timeout):

1. Run `release-close verify --version v0.1.1 --sha <sha>` to assess current state
2. Check for partial artifacts (draft release, open milestone)
3. Use the `nextAction` from evidence to resume
4. Resume requires the same `--version` and `--sha`

## Conflict Resolution

If a conflict is detected (duplicate or conflicting Release/Milestone):

1. Review the conflict evidence
2. Manually resolve the conflict in GitHub UI
3. Re-run verify to confirm resolution
4. Re-run apply

## Rollback Boundaries

- The annotated tag `v0.1.1` is immutable — never delete or move it
- Releases can be unpublished but not deleted
- Milestones can be reopened but not deleted
- No rollback of published release content

## Live v0.1.1 Procedure

### Prerequisites

- GitHub token with `repo` scope
- `release-close` CLI built and available
- Target SHA: `10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`

### Steps

1. **Verify**: `release-close verify --version v0.1.1 --sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`
2. **Review**: Check the plan output for any warnings
3. **Apply**: `release-close apply --version v0.1.1 --sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf --confirm sim`
4. **Verify again**: `release-close verify --version v0.1.1 --sha 10c62ac85fd3ab275b8926c89f5f34ba4116e2cf`
5. **Confirm**: Check GitHub UI for published release and closed milestone

## Evidence Format

All commands support `--evidence` for structured JSON output:

```json
{
  "action": "ci-wait",
  "timestamp": "2026-09-25T22:48:50.728Z",
  "targetSha": "10c62ac85fd3ab275b8926c89f5f34ba4116e2cf",
  "aborted": false,
  "abortReason": null,
  "nextAction": "proceed to mutation",
  "runs": [...],
  "release": { "id": "...", "url": "...", "tagName": "v0.1.1" },
  "milestone": { "number": 1, "url": "...", "title": "v0.1.1" }
}
```

## Troubleshooting

| Symptom | Cause | Action |
|---------|-------|--------|
| `ELIGIBLE` but apply fails | CI not settled | Wait and rerun |
| `409 Conflict` | Duplicate object | Resolve in GitHub UI |
| Timeout | CI taking too long | Increase `--timeout` |
| Partial state | Interrupted apply | Use `nextAction` to resume |
