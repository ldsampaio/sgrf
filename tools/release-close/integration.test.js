import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('./release-close.js', import.meta.url));
const LIVE = JSON.parse(readFileSync(new URL('./fixtures/live-baseline.json', import.meta.url)));

function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 30_000 });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('integration: verify command end-to-end', () => {
  it('verify --fixture reports tag, main, CI, Release, Milestone with mutations: 0', () => {
    const result = runCli([
      'verify', '--fixture', '--json',
      '--version', LIVE.version,
      '--sha', LIVE.expectedSha,
    ]);
    assert.equal(result.status, 0, `verify --fixture failed: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.tag.code, 'ELIGIBLE');
    assert.equal(json.main.ok, true);
    assert.equal(json.mutations, 0);
  });

  it('verify --fixture on divergent SHA reports SAFE-02', () => {
    const result = runCli([
      'verify', '--fixture', '--json',
      '--version', LIVE.version,
      '--sha', 'b'.repeat(40),
    ]);
    assert.notEqual(result.status, 0, 'divergent SHA should fail');
    const json = JSON.parse(result.stdout);
    assert.equal(json.tag.code, 'SAFE-02');
    assert.equal(json.mutations, 0);
  });

  it('verify with real gh CLI reports ELIGIBLE for the live baseline', () => {
    const result = runCli([
      'verify', '--json',
      '--version', LIVE.version,
      '--sha', LIVE.expectedSha,
    ]);
    assert.equal(result.status, 0, `verify live failed: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.tag.code, 'ELIGIBLE');
    assert.equal(json.main.ok, true);
    assert.equal(json.mutations, 0);
  });

  it('verify with real gh CLI reports missing Release/Milestone', () => {
    const result = runCli([
      'verify', '--json',
      '--version', LIVE.version,
      '--sha', LIVE.expectedSha,
    ]);
    assert.equal(result.status, 0, `verify live failed: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.release.present, false);
    assert.equal(json.milestone.present, false);
  });
});
