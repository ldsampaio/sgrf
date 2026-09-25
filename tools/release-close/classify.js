// Classificação de snapshot em seis estados (OPS-02): função pura.
//
// Entrada: objeto plano de evidência com os campos release, milestone, checks
// e eligibility (mais releases e closeMarkers para os cenários de duplicata
// e concorrência). Nenhuma rede, nenhum relógio, nenhuma escrita.
//
// Saída: { eligible, code, reason, writeAction } — mesma família do
// contrato de elegibilidade: code em EN estável, reason humana em PT-BR, writeAction
// sempre null (classificar nunca autoriza alteração remota).
//
// Precedência (primeira regra que casa vence, exame de cima para baixo):
//   FAILED      — checks vermelhos (state ou conclusion 'failure').
//   CONCURRENT  — dois ou mais marcadores de fechamento em andamento.
//   CONFLICTING — duas ou mais releases da mesma tag materialmente
//                 diferentes (algum targetSha diverge).
//   DUPLICATE   — duas ou mais releases da mesma tag idênticas
//                 (mesmo tagName e mesmo targetSha).
//   PARTIAL     — alguma release presente (rascunho ou avulsa) ou
//                 milestone presente sem fechamento completo.
//   MISSING     — release e milestone ausentes sobre baseline elegível.
//
// Divergências de domínio retornam dados (fail-closed por dados).
// `throw` (sempre TypeError, mensagem em PT-BR) é reservado a snapshot
// com formato inválido. Este módulo não importa o módulo de elegibilidade
// (D-09: funções puras independentes e testáveis em separado).

const CODES = ['MISSING', 'PARTIAL', 'DUPLICATE', 'CONFLICTING', 'FAILED', 'CONCURRENT'];

function invalid(message) {
  return new TypeError(message);
}

function decided(code, reason) {
  return { eligible: false, code, reason, writeAction: null };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checksFailed(checks) {
  if (!isRecord(checks)) return false;
  if (checks.state === 'failure' || checks.conclusion === 'failure') return true;
  if (Array.isArray(checks.runs)) {
    return checks.runs.some(
      (run) => isRecord(run) && (run.conclusion === 'failure' || run.state === 'failure'),
    );
  }
  return false;
}

function inFlightMarkers(snapshot) {
  if (!Array.isArray(snapshot.closeMarkers)) return [];
  return snapshot.closeMarkers.filter(
    (marker) => isRecord(marker) && marker.state === 'in_progress',
  );
}

function listedReleases(snapshot) {
  if (Array.isArray(snapshot.releases)) return snapshot.releases.filter(isRecord);
  return [];
}

function releaseKey(release) {
  return `${release.tagName ?? ''}@${release.targetSha ?? release.sha ?? ''}`;
}

export function classifySnapshot(snapshot) {
  if (!isRecord(snapshot)) {
    throw invalid('Snapshot inválido: esperado um objeto plano com release, milestone, checks e eligibility.');
  }

  if (checksFailed(snapshot.checks)) {
    return decided(
      'FAILED',
      'Verificações vermelhas na evidência: o fechamento está bloqueado até o sinal verde.',
    );
  }

  const inFlight = inFlightMarkers(snapshot);
  if (inFlight.length >= 2) {
    return decided(
      'CONCURRENT',
      `Fechamento concorrente: ${inFlight.length} marcadores de fechamento em andamento; operador único deve arbitrar antes de prosseguir.`,
    );
  }

  const releases = listedReleases(snapshot);
  if (releases.length >= 2) {
    const keys = new Set(releases.map(releaseKey));
    if (keys.size === 1) {
      return decided(
        'DUPLICATE',
        `Release duplicada: ${releases.length} releases idênticas da mesma tag (${releases[0].tagName ?? 'sem tag'}); nenhuma foi removida ou adotada por esta classificação.`,
      );
    }
    return decided(
      'CONFLICTING',
      `Releases conflitantes da mesma tag com alvos materialmente diferentes (${[...keys].join(' vs ')}); a ambiguidade nunca é resolvida com escrita por esta classificação.`,
    );
  }

  if (isRecord(snapshot.release) || releases.length === 1 || isRecord(snapshot.milestone)) {
    if (isRecord(snapshot.release) && snapshot.release.draft === true) {
      return decided(
        'PARTIAL',
        `Fechamento parcial: release de rascunho (${snapshot.release.tagName ?? 'sem tag'}) presente sem fechamento completo.`,
      );
    }
    return decided(
      'PARTIAL',
      'Fechamento parcial: evidência de release ou milestone presente sem fechamento completo.',
    );
  }

  return decided(
    'MISSING',
    'Fechamento ausente: nenhuma release e nenhuma milestone na evidência sobre o baseline elegível.',
  );
}

export const CLASSIFY_CODES = CODES;
