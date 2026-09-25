// Classificação de snapshot em seis estados (OPS-02): função pura.
//
// Contrato de entrada — cinco chaves obrigatórias, todas validadas na entrada:
//   target       -> { version, expectedSha } com expectedSha em 40 hex minúsculos
//   ci           -> { event: 'push', targetSha, requiredRunIds[2], records[] }
//   releases     -> lista de registros de Release
//   milestones   -> lista de registros de Milestone
//   closeMarkers -> lista de marcadores de fechamento
//
// Um bloco `target` ou `ci` ausente ou malformado é TypeError com mensagem em
// PT-BR, nunca um padrão leniente: um bloco de CI ausente é violação de
// contrato e não pode ser lido como execução verde. Nenhuma rede, nenhum
// relógio, nenhuma escrita.
//
// Allowlist de CI (T-09-05-01): a CI só deixa de bloquear quando, para cada
// execução obrigatória, existe exatamente um registro `backend` e exatamente um
// registro `frontend` cujo headSha é byte-idêntico ao SHA do alvo, com status
// `completed` e conclusão `success`. Qualquer outra evidência bloqueia com uma
// das onze famílias nomeadas, na ordem de avaliação malformado -> ausente ->
// execução errada -> SHA errado -> família de conclusão/status -> contraditória.
// A mesma evidência sempre devolve a mesma família.
//
// Saída: { eligible, code, reason, ciCode, writeAction } — code em EN estável,
// reason humana em PT-BR, ciCode em EN estável (null quando a decisão não veio
// de uma família de CI) e writeAction sempre null (classificar nunca autoriza
// alteração remota).
//
// Precedência (primeira regra que casa vence, exame de cima para baixo):
//   FAILED      — CI fora da allowlist, ou execução declarada vermelha.
//   CONCURRENT  — dois ou mais marcadores de fechamento em andamento.
//   CONFLICTING — duas ou mais releases da mesma versão com alvos
//                 materialmente diferentes (algum targetSha diverge).
//   DUPLICATE   — duas ou mais releases da mesma versão idênticas.
//   PARTIAL     — alguma release presente (rascunho ou avulsa) ou milestone
//                 presente sem fechamento completo.
//   MISSING     — release e milestone ausentes sobre baseline elegível.
//
// Divergências de domínio retornam dados (fail-closed por dados).
// `throw` (sempre TypeError, mensagem em PT-BR) é reservado a snapshot
// com formato inválido. Este módulo não importa o módulo de elegibilidade
// (D-09: funções puras independentes e testáveis em separado).

const CODES = ['MISSING', 'PARTIAL', 'DUPLICATE', 'CONFLICTING', 'FAILED', 'CONCURRENT'];

// Os dois jobs canônicos de .github/workflows/ci.yml. Nenhum outro nome de job
// pode desbloquear: um job desconhecido é CI-UNKNOWN.
const REQUIRED_JOBS = ['backend', 'frontend'];

// As onze famílias bloqueantes, em EN estável. `ciCode` nunca carrega uma
// sétima família: uma execução declarada explicitamente vermelha pertence ao
// gatilho de estado, não a uma família de evidência, e por isso leva ciCode
// nulo em vez de emprestar um nome que não descreve o que foi visto.
const CI_FAMILIES = [
  'CI-MALFORMED',
  'CI-MISSING',
  'CI-WRONG-RUN',
  'CI-WRONG-SHA',
  'CI-PENDING',
  'CI-CANCELLED',
  'CI-TIMED-OUT',
  'CI-ACTION-REQUIRED',
  'CI-NEUTRAL',
  'CI-UNKNOWN',
  'CI-CONTRADICTORY',
];

// SHA completo em hexadecimal minúsculo: um valor abreviado nunca é aceito.
const SHA_COMPLETO = /^[0-9a-f]{40}$/;

const CAMPOS_DO_REGISTRO = ['runId', 'job', 'headSha', 'status', 'conclusion'];

// Conclusões que a GitHub nomeia e que merecem família própria. Toda outra
// conclusão fora de `success` é CI-UNKNOWN: a allowlist é positiva, então um
// vermelho concludido nunca é lido como verde nem como ausência.
const CONCLUSOES_NOMEADAS = new Map([
  ['cancelled', 'CI-CANCELLED'],
  ['timed_out', 'CI-TIMED-OUT'],
  ['action_required', 'CI-ACTION-REQUIRED'],
  ['neutral', 'CI-NEUTRAL'],
  ['skipped', 'CI-NEUTRAL'],
]);

function invalid(message) {
  return new TypeError(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decided(code, reason, ciCode = null) {
  return { eligible: false, code, reason, ciCode, writeAction: null };
}

function bloqueio(ciCode, reason) {
  return { ciCode, reason };
}

// As três listas de evidência. `milestones` é verificada primeiro porque é a
// chave que distingue as duas formas declaradas: lista (evidência plana de
// classificação) contra envelope `ok` (snapshot de cliente), e o envelope nunca
// é entrada do classificador.
const LISTAS_EVIDENCIA = ['milestones', 'releases', 'closeMarkers'];

function assertContract(snapshot) {
  if (!isRecord(snapshot)) {
    throw invalid('Snapshot inválido: esperado um objeto plano com target, ci, releases, milestones e closeMarkers.');
  }

  if (!isRecord(snapshot.target)) {
    throw invalid('Snapshot inválido: bloco target ausente; o alvo do fechamento é obrigatório.');
  }
  if (typeof snapshot.target.version !== 'string' || snapshot.target.version.length === 0) {
    throw invalid('Snapshot inválido: target.version ausente ou vazia.');
  }
  if (!SHA_COMPLETO.test(String(snapshot.target.expectedSha))) {
    throw invalid('Snapshot inválido: target.expectedSha não é um SHA completo de 40 hex minúsculos.');
  }

  if (!isRecord(snapshot.ci)) {
    throw invalid('Snapshot inválido: bloco ci ausente; a evidência de CI é obrigatória e nunca é assumida verde.');
  }
  if (snapshot.ci.event !== 'push') {
    throw invalid('Snapshot inválido: ci.event deve ser exatamente push.');
  }
  if (!SHA_COMPLETO.test(String(snapshot.ci.targetSha))) {
    throw invalid('Snapshot inválido: ci.targetSha não é um SHA completo de 40 hex minúsculos.');
  }
  if (
    !Array.isArray(snapshot.ci.requiredRunIds) ||
    snapshot.ci.requiredRunIds.length !== 2 ||
    !snapshot.ci.requiredRunIds.every((runId) => Number.isInteger(runId))
  ) {
    throw invalid('Snapshot inválido: ci.requiredRunIds deve ser exatamente dois identificadores de execução numéricos.');
  }
  if (!Array.isArray(snapshot.ci.records)) {
    throw invalid('Snapshot inválido: ci.records deve ser uma lista de registros de verificação.');
  }

  for (const chave of LISTAS_EVIDENCIA) {
    if (!Array.isArray(snapshot[chave])) {
      throw invalid(
        `Snapshot inválido: ${chave} deve ser uma lista de evidência; um envelope de cliente nunca é entrada do classificador.`,
      );
    }
  }

  // O gatilho vermelho explícito é opcional, mas nunca pode ser malformado em
  // silêncio: um sinal vermelho estruturalmente quebrado é violação de contrato.
  if (snapshot.failedRunIds !== undefined && !Array.isArray(snapshot.failedRunIds)) {
    throw invalid('Snapshot inválido: failedRunIds deve ser uma lista de identificadores de execução.');
  }
}

function familiaDoRegistro(registro) {
  if (registro.status !== 'completed') return 'CI-PENDING';
  if (!REQUIRED_JOBS.includes(registro.job)) return 'CI-UNKNOWN';
  const nomeada = CONCLUSOES_NOMEADAS.get(registro.conclusion);
  if (nomeada !== undefined) return nomeada;
  if (registro.conclusion !== 'success') return 'CI-UNKNOWN';
  return null;
}

function familiaDoGrupo(grupo) {
  for (const registro of grupo) {
    const familia = familiaDoRegistro(registro);
    if (familia !== null) return familia;
  }
  return null;
}

function descricaoDaFamilia(familia, registro) {
  const onde = `registro ${registro.job} da execução ${registro.runId}`;
  if (familia === 'CI-PENDING') {
    return `Verificação não concluída: ${onde} está com status ${String(registro.status)}, e somente completed libera a CI.`;
  }
  if (familia === 'CI-CANCELLED') {
    return `Verificação cancelada: ${onde} concluiu como cancelled.`;
  }
  if (familia === 'CI-TIMED-OUT') {
    return `Verificação expirada: ${onde} concluiu como timed_out.`;
  }
  if (familia === 'CI-ACTION-REQUIRED') {
    return `Verificação exigindo ação: ${onde} concluiu como action_required.`;
  }
  if (familia === 'CI-NEUTRAL') {
    return `Verificação neutra ou pulada: ${onde} concluiu como ${String(registro.conclusion)}, que não é sinal verde.`;
  }
  return `Verificação fora da allowlist: ${onde} não é um dos jobs canônicos com conclusão success (conclusão ${String(registro.conclusion)}).`;
}

// Allowlist de CI. Devolve null quando a evidência libera, ou o bloqueio com a
// família nomeada. A ordem de avaliação é fixa e determinística.
function avaliarCi(ci, expectedSha) {
  const registros = ci.records;

  // 1. Malformado.
  for (const registro of registros) {
    if (!isRecord(registro)) {
      return bloqueio(
        'CI-MALFORMED',
        `Registro de verificação não é um registro plano: a evidência de CI está estruturalmente quebrada.`,
      );
    }
    for (const campo of CAMPOS_DO_REGISTRO) {
      if (registro[campo] === undefined) {
        return bloqueio(
          'CI-MALFORMED',
          `Registro de verificação sem o campo obrigatório ${campo}: a evidência de CI está estruturalmente quebrada.`,
        );
      }
    }
    if (!Number.isInteger(registro.runId)) {
      return bloqueio(
        'CI-MALFORMED',
        `Registro de verificação com identificador de execução não numérico (${String(registro.runId)}): a evidência de CI está estruturalmente quebrada.`,
      );
    }
  }

  // 2. Ausente.
  if (registros.length === 0) {
    return bloqueio(
      'CI-MISSING',
      'Nenhum registro de verificação na evidência de CI: sem registro não há como confirmar o sinal verde.',
    );
  }
  for (const runId of ci.requiredRunIds) {
    for (const job of REQUIRED_JOBS) {
      if (!registros.some((registro) => registro.runId === runId && registro.job === job)) {
        return bloqueio(
          'CI-MISSING',
          `Execução ${runId} não tem registro de verificação do job ${job}: cada execução obrigatória exige backend e frontend.`,
        );
      }
    }
  }

  // 3. Execução errada.
  for (const registro of registros) {
    if (!ci.requiredRunIds.includes(registro.runId)) {
      return bloqueio(
        'CI-WRONG-RUN',
        `Registro de verificação da execução ${registro.runId}, fora das duas identidades obrigatórias (${ci.requiredRunIds.join(' e ')}).`,
      );
    }
  }

  // 4. SHA errado: a evidência precisa ser do commit que o alvo pede, e cada
  // registro precisa trazer o SHA completo.
  if (ci.targetSha !== expectedSha) {
    return bloqueio(
      'CI-WRONG-SHA',
      `A evidência de CI é do commit ${ci.targetSha} e o alvo pedido é ${expectedSha}: verificação de outro commit não libera este fechamento.`,
    );
  }
  for (const registro of registros) {
    if (!SHA_COMPLETO.test(String(registro.headSha)) || registro.headSha !== ci.targetSha) {
      return bloqueio(
        'CI-WRONG-SHA',
        `Registro de verificação ${registro.job} da execução ${registro.runId} traz headSha ${String(registro.headSha)}, diferente do alvo completo ${ci.targetSha}.`,
      );
    }
  }

  // 5 e 6. Família de conclusão/status e contradição, sobre a mesma
  // partição por (execução, job). Um slot com mais de um registro tem a
  // contradição como achado, então ele não é julgado por uma das cópias.
  const slots = new Map();
  for (const registro of registros) {
    const chave = `${registro.runId}::${registro.job}`;
    if (!slots.has(chave)) slots.set(chave, []);
    slots.get(chave).push(registro);
  }
  for (const grupo of slots.values()) {
    if (grupo.length !== 1) continue;
    const familia = familiaDoGrupo(grupo);
    if (familia !== null) return bloqueio(familia, descricaoDaFamilia(familia, grupo[0]));
  }
  for (const grupo of slots.values()) {
    if (grupo.length < 2) continue;
    const conclusoes = new Set(grupo.map((registro) => registro.conclusion));
    if (conclusoes.size > 1) {
      return bloqueio(
        'CI-CONTRADICTORY',
        `A execução ${grupo[0].runId} traz ${grupo.length} registros do job ${grupo[0].job} com conclusões contraditórias (${[...conclusoes].join(', ')}).`,
      );
    }
    const familia = familiaDoGrupo(grupo);
    if (familia !== null) return bloqueio(familia, descricaoDaFamilia(familia, grupo[0]));
  }

  return null;
}

function execucoesVermelhas(snapshot) {
  if (!Array.isArray(snapshot.failedRunIds)) return [];
  return snapshot.failedRunIds.filter((runId) => Number.isInteger(runId));
}

function inFlightMarkers(snapshot) {
  return snapshot.closeMarkers.filter(
    (marker) => isRecord(marker) && marker.state === 'in_progress',
  );
}

function registrosValidos(lista) {
  return lista.filter(isRecord);
}

function releaseKey(release) {
  return `${release.tagName ?? ''}@${release.targetSha ?? release.sha ?? ''}`;
}

export function classifySnapshot(snapshot) {
  assertContract(snapshot);

  const bloqueioCi = avaliarCi(snapshot.ci, snapshot.target.expectedSha);
  if (bloqueioCi !== null) {
    return decided('FAILED', bloqueioCi.reason, bloqueioCi.ciCode);
  }

  const vermelhas = execucoesVermelhas(snapshot);
  if (vermelhas.length > 0) {
    return decided(
      'FAILED',
      `Execução(ões) ${vermelhas.join(', ')} declarada(s) vermelha(s) na evidência congelada: o fechamento está bloqueado até o sinal verde.`,
    );
  }

  const inFlight = inFlightMarkers(snapshot);
  if (inFlight.length >= 2) {
    return decided(
      'CONCURRENT',
      `Fechamento concorrente: ${inFlight.length} marcadores de fechamento em andamento; operador único deve arbitrar antes de prosseguir.`,
    );
  }

  const releases = registrosValidos(snapshot.releases);
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

  const milestones = registrosValidos(snapshot.milestones);
  if (releases.length === 1 && releases[0].draft === true) {
    return decided(
      'PARTIAL',
      `Fechamento parcial: release de rascunho (${releases[0].tagName ?? 'sem tag'}) presente sem fechamento completo.`,
    );
  }
  if (releases.length >= 1 || milestones.length >= 1) {
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
export const CLASSIFY_CI_FAMILIES = CI_FAMILIES;
export const CLASSIFY_REQUIRED_JOBS = REQUIRED_JOBS;
