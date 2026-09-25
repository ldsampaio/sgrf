// gh-client.js: costura real para o `gh` CLI, Fase 10.
//
// Cada um dos seis métodos de leitura usa `gh api` via child_process.execFile
// (nunca exec — sem shell, sem injeção). Retorna sempre o envelope
// normalizado { ok, status, data }:
//   - ok: boolean — true quando o objeto existe no remoto.
//   - status: número — código análogo a HTTP (200 existente, 404 ausente).
//   - data: objeto com os campos abaixo, ou null quando ausente.
//
// 404 nunca lança — mapeia para { ok: false, status: 404, data: null }.
// Outros erros lançam com mensagem PT-BR nomeando o método.
// Nenhum segredo é lido, registrado ou transmitido — o `gh` CLI handleia
// auth via seu próprio config.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertClientShape } from './client.js';

const execFileAsync = promisify(execFile);

const REPO = 'ldsampaio/sgrf';

async function ghApi(endpoint) {
  try {
    const { stdout } = await execFileAsync('gh', ['api', endpoint], { timeout: 30_000 });
    return JSON.parse(stdout);
  } catch (err) {
    const stderr = err.stderr || '';
    if (stderr.includes('404') || err.status === 1) {
      return { ok: false, status: 404, data: null };
    }
    throw new Error(
      `Leitura remota falhou: ${endpoint} — ${stderr || err.message}`,
    );
  }
}

export async function getTagRef(version) {
  const data = await ghApi(`/repos/${REPO}/git/ref/tags/${version}`);
  if (!data || data.status === 404) return { ok: false, status: 404, data: null };
  return { ok: true, status: 200, data };
}

export async function getTagObject(tagSha) {
  const data = await ghApi(`/repos/${REPO}/git/tags/${tagSha}`);
  if (!data || data.status === 404) return { ok: false, status: 404, data: null };
  return { ok: true, status: 200, data };
}

export async function getBranchHead(branch = 'main') {
  const envelope = await ghApi(`/repos/${REPO}/git/refs/heads/${branch}`);
  if (!envelope || envelope.status === 404) return { ok: false, status: 404, data: null };
  return { ok: true, status: 200, data: { sha: envelope.object.sha } };
}

export async function getReleaseByTag(version) {
  const data = await ghApi(`/repos/${REPO}/releases/tags/${version}`);
  if (!data || data.status === 404) return { ok: false, status: 404, data: null };
  return { ok: true, status: 200, data };
}

export async function listMilestones() {
  const data = await ghApi(`/repos/${REPO}/milestones?state=all&per_page=100`);
  if (!data || data.status === 404) return { ok: false, status: 404, data: null };
  const milestones = Array.isArray(data) ? data : [];
  return { ok: true, status: 200, data: milestones.map(m => ({ number: m.number, title: m.title, state: m.state })) };
}

export async function listCiRuns(expectedSha, branch = 'main') {
  const data = await ghApi(`/repos/${REPO}/actions/runs?event=push&per_page=100&branch=${branch}&head_sha=${expectedSha}`);
  if (!data || data.status === 404) return { ok: false, status: 404, data: { runs: [], failedRunIds: [] } };
  const records = Array.isArray(data.workflow_runs) ? data.workflow_runs : (Array.isArray(data) ? data : []);
  const failedRunIds = records
    .filter(r => r.status === 'completed' && r.conclusion !== 'success')
    .map(r => r.id);
  return { ok: true, status: 200, data: { runs: records, failedRunIds } };
}

export const ghClient = {
  getTagRef,
  getTagObject,
  getBranchHead,
  getReleaseByTag,
  listMilestones,
  listCiRuns,
  get mutations() { return 0; },
};

assertClientShape(ghClient);
