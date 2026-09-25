// Prova da expansão: classificador de seis estados sobre fixtures
// versionados mais sequências roteirizadas do fake (OPS-02).
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede,
// sem banco). Nomes em PT-BR seguindo a convenção de backend/tests/.
//
// Convenção de probes novos (herdada de 09-04, Pitfall do recuo de TAP): todo
// probe deste contrato é um `it()` de NÍVEL SUPERIOR, fora de qualquer
// `describe`. O node recua subtestes aninhadas com oito espaços e o portão
// `check tdd-red-evidence` só reconhece uma linha `not ok` na coluna 0 — um
// probe aninhado produziria um RED invisível, e portanto inválido.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifySnapshot } from './classify.js';
import { makeFakeClient } from './fake-client.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

const EXPECTED = {
  missing: 'MISSING',
  partial: 'PARTIAL',
  duplicate: 'DUPLICATE',
  conflicting: 'CONFLICTING',
  failed: 'FAILED',
  concurrent: 'CONCURRENT',
};

describe('classificação de snapshot em seis estados (OPS-02)', () => {
  for (const [name, code] of Object.entries(EXPECTED)) {
    it(`classifica o fixture ${name} como ${code} com motivo PT-BR e sem ação de escrita`, () => {
      const decisao = classifySnapshot(fixture(name));
      assert.equal(decisao.code, code);
      assert.equal(decisao.eligible, false);
      assert.equal(decisao.writeAction, null);
      assert.equal(typeof decisao.reason, 'string');
      assert.ok(decisao.reason.length > 0);
    });
  }

  it('não importa o módulo de elegibilidade (contrato independente, D-09)', () => {
    const fonte = readFileSync(new URL('./classify.js', import.meta.url), 'utf8');
    assert.ok(!/from\s+['"]\.\/eligibility\.js['"]/.test(fonte));
    assert.ok(!/require\(\s*['"]\.\/eligibility(\.js)?['"]\s*\)/.test(fonte));
    assert.ok(!/import\s+.*eligibility/.test(fonte));
  });

  it('sequência roteirizada 409 depois 429 depois dado é observável no log de chamadas', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap, { getTagRef: ['status-409', 'status-429'] });
    const primeira = await fake.getTagRef('v0.1.1');
    const segunda = await fake.getTagRef('v0.1.1');
    const terceira = await fake.getTagRef('v0.1.1');
    assert.equal(primeira.status, 409);
    assert.equal(primeira.ok, false);
    assert.equal(segunda.status, 429);
    assert.equal(terceira.ok, true);
    assert.deepEqual(
      fake.calls.map((c) => [c.seq, c.method]),
      [[1, 'getTagRef'], [2, 'getTagRef'], [3, 'getTagRef']],
    );
  });

  it('leituras seguem a ordem ref, tag-object, main, release, milestones no log', async () => {
    const fake = makeFakeClient(fixture('reference'));
    await fake.getTagRef('v0.1.1');
    await fake.getTagObject('0a68d6f0c55e7be07d13a0bbc4ed36d4af772630');
    await fake.getBranchHead('main');
    await fake.getReleaseByTag('v0.1.1');
    await fake.listMilestones();
    assert.deepEqual(
      fake.calls.map((c) => c.method),
      ['getTagRef', 'getTagObject', 'getBranchHead', 'getReleaseByTag', 'listMilestones'],
    );
    assert.deepEqual(fake.calls.map((c) => c.seq), [1, 2, 3, 4, 5]);
  });

  it('fixture failed carrega FAILED com motivo PT-BR e sem ação de escrita', () => {
    const decisao = classifySnapshot(fixture('failed'));
    assert.equal(decisao.code, 'FAILED');
    assert.equal(decisao.writeAction, null);
    assert.ok(decisao.reason.length > 0);
  });

  it('rejeita snapshot com formato inválido com TypeError', () => {
    for (const invalido of [null, undefined, 'v0.1.1', 42, ['missing']]) {
      assert.throws(() => classifySnapshot(invalido), TypeError);
    }
  });

  it('classifica o estado concorrente de forma determinística em duas leituras', () => {
    const snap = fixture('concurrent');
    const primeira = classifySnapshot(snap);
    const segunda = classifySnapshot(JSON.parse(JSON.stringify(snap)));
    assert.equal(primeira.code, 'CONCURRENT');
    assert.deepEqual(segunda, primeira);
  });

  it('nenhum objeto de decisão carrega ação de escrita nos seis fixtures de evidência plana', () => {
    // O fixture `reference` não é entrada do classificador: ele é um snapshot
    // no formato de cliente (envelopes `release` e `milestones`), e o formato
    // nunca é aceito. A prova de que ele é rejeitado é o probe de nível
    // superior logo abaixo deste bloco.
    for (const name of Object.keys(EXPECTED)) {
      const decisao = classifySnapshot(fixture(name));
      assert.equal(decisao.writeAction, null, `fixture ${name} com writeAction não-nulo`);
    }
  });
});

// ---------------------------------------------------------------------------
// Contrato de cinco chaves e allowlist de CI (probes de nível superior).
// ---------------------------------------------------------------------------

// Nomes de job canônicos: contrato de .github/workflows/ci.yml, não dado
// congelado — por isso são literal aqui.
const JOBS_CANONICOS = ['backend', 'frontend'];

const clonar = (valor) => JSON.parse(JSON.stringify(valor));

// Bloco CI canônico derivado do fixture congelado (D-08): o SHA alvo vem do
// expectedSha que missing.json já carrega e as execuções vêm do runs que ele
// já carrega. Nenhum SHA nem identificador de execução é retyped no teste.
function blocoCanonic(base = fixture('missing')) {
  const alvo = base.expectedSha;
  return {
    event: 'push',
    targetSha: alvo,
    requiredRunIds: [...base.runs],
    records: base.runs.flatMap((runId) =>
      JOBS_CANONICOS.map((job) => ({
        runId,
        job,
        headSha: alvo,
        status: 'completed',
        conclusion: 'success',
      })),
    ),
  };
}

// Evidência plana mínima no contrato de cinco chaves, com o bloco `ci` que o
// caso precisa. `reference` nunca entra por aqui: é formato de cliente.
function evidenciaComCi(ci) {
  const base = fixture('missing');
  return {
    target: { version: base.version, expectedSha: base.expectedSha },
    ci,
    releases: [],
    milestones: [],
    closeMarkers: [],
  };
}

function comRegistro(canonico, indice, mudanca) {
  const clonado = clonar(canonico);
  Object.assign(clonado.records[indice], mudanca);
  return clonado;
}

function semCampo(canonico, indice, campo) {
  const clonado = clonar(canonico);
  delete clonado.records[indice][campo];
  return clonado;
}

// Uma linha por família bloqueante, com o código EN exato que a decisão deve
// carregar. A ordem de Families cobre as onze famílias declaradas.
const FAMILIAS_CI = [
  {
    nome: 'evidência vazia',
    ciCode: 'CI-MISSING',
    montar: (c) => ({ ...c, records: [] }),
  },
  {
    nome: 'job canônico ausente em uma das execuções obrigatórias',
    ciCode: 'CI-MISSING',
    montar: (c) => ({
      ...c,
      records: c.records.filter(
        (r) => !(r.runId === c.requiredRunIds[0] && r.job === 'frontend'),
      ),
    }),
  },
  {
    nome: 'status não concluído',
    ciCode: 'CI-PENDING',
    montar: (c) => comRegistro(c, 0, { status: 'in_progress' }),
  },
  {
    nome: 'conclusão cancelada',
    ciCode: 'CI-CANCELLED',
    montar: (c) => comRegistro(c, 0, { conclusion: 'cancelled' }),
  },
  {
    nome: 'conclusão timed_out',
    ciCode: 'CI-TIMED-OUT',
    montar: (c) => comRegistro(c, 0, { conclusion: 'timed_out' }),
  },
  {
    nome: 'conclusão action_required',
    ciCode: 'CI-ACTION-REQUIRED',
    montar: (c) => comRegistro(c, 0, { conclusion: 'action_required' }),
  },
  {
    nome: 'conclusão neutral',
    ciCode: 'CI-NEUTRAL',
    montar: (c) => comRegistro(c, 0, { conclusion: 'neutral' }),
  },
  {
    nome: 'conclusão skipped',
    ciCode: 'CI-NEUTRAL',
    montar: (c) => comRegistro(c, 0, { conclusion: 'skipped' }),
  },
  {
    nome: 'conclusão fora da allowlist',
    ciCode: 'CI-UNKNOWN',
    montar: (c) => comRegistro(c, 0, { conclusion: 'failure' }),
  },
  {
    nome: 'nome de job desconhecido',
    ciCode: 'CI-UNKNOWN',
    montar: (c) => ({
      ...c,
      records: [
        ...c.records,
        {
          runId: c.requiredRunIds[1],
          job: 'lint',
          headSha: c.targetSha,
          status: 'completed',
          conclusion: 'success',
        },
      ],
    }),
  },
  {
    nome: 'headSha abreviado',
    ciCode: 'CI-WRONG-SHA',
    montar: (c) => comRegistro(c, 0, { headSha: c.targetSha.slice(0, 7) }),
  },
  {
    nome: 'headSha divergente do alvo',
    ciCode: 'CI-WRONG-SHA',
    montar: (c) => comRegistro(c, 0, { headSha: 'a'.repeat(40) }),
  },
  {
    nome: 'ci.targetSha diferente do SHA do alvo',
    ciCode: 'CI-WRONG-SHA',
    montar: (c) => ({ ...c, targetSha: 'b'.repeat(40) }),
  },
  {
    nome: 'execução fora das duas identidades obrigatórias',
    ciCode: 'CI-WRONG-RUN',
    montar: (c) => ({
      ...c,
      records: [
        ...c.records,
        {
          runId: 99999999,
          job: 'backend',
          headSha: c.targetSha,
          status: 'completed',
          conclusion: 'success',
        },
      ],
    }),
  },
  {
    nome: 'mesma execução e mesmo job com conclusões diferentes',
    ciCode: 'CI-CONTRADICTORY',
    montar: (c) => ({
      ...c,
      records: [...c.records, { ...c.records[0], conclusion: 'failure' }],
    }),
  },
  {
    nome: 'registro sem campo obrigatório',
    ciCode: 'CI-MALFORMED',
    montar: (c) => semCampo(c, 0, 'conclusion'),
  },
  {
    nome: 'registro que não é registro plano',
    ciCode: 'CI-MALFORMED',
    montar: (c) => {
      const clonado = clonar(c);
      clonado.records[0] = 'nao-e-registro';
      return clonado;
    },
  },
  {
    nome: 'runId não numérico',
    ciCode: 'CI-MALFORMED',
    montar: (c) => comRegistro(c, 0, { runId: String(c.records[0].runId) }),
  },
];

it('matriz de famílias de CI: toda evidência fora da allowlist bloqueia com o código exato', () => {
  const falhas = [];
  for (const familia of FAMILIAS_CI) {
    const decisao = classifySnapshot(evidenciaComCi(familia.montar(blocoCanonic())));
    const esperado = [
      ['code', 'FAILED'],
      ['ciCode', familia.ciCode],
      ['eligible', false],
      ['writeAction', null],
    ];
    for (const [chave, valor] of esperado) {
      if (decisao[chave] !== valor) {
        falhas.push(
          `${familia.nome}: ${chave} = ${JSON.stringify(decisao[chave])} (esperado ${JSON.stringify(valor)})`,
        );
      }
    }
    if (typeof decisao.reason !== 'string' || decisao.reason.length === 0) {
      falhas.push(`${familia.nome}: motivo PT-BR vazio`);
    }
  }
  assert.deepEqual(falhas, [], `famílias de CI fora do contrato:\n${falhas.join('\n')}`);
});

it('bloco CI canônico verde não bloqueia a classificação', () => {
  const decisao = classifySnapshot(evidenciaComCi(blocoCanonic()));
  assert.equal(decisao.code, 'MISSING');
  assert.equal(decisao.ciCode, null, 'evidência verde não pertence a nenhuma família bloqueante');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.length > 0);
});

it('snapshot sem bloco target é violação de contrato (TypeError)', () => {
  const evidencia = evidenciaComCi(blocoCanonic());
  delete evidencia.target;
  assert.throws(() => classifySnapshot(evidencia), TypeError);
});

it('snapshot sem bloco ci é violação de contrato (TypeError)', () => {
  const evidencia = evidenciaComCi(blocoCanonic());
  delete evidencia.ci;
  assert.throws(() => classifySnapshot(evidencia), TypeError);
});

it('snapshot em formato de cliente é rejeitado pelo classificador (TypeError)', () => {
  // `milestones` é envelope, não lista: o formato do cliente nunca é entrada
  // do classificador, e a rejeição é uma violação de contrato, não um palpite.
  assert.throws(() => classifySnapshot(fixture('reference')), TypeError);
});

// ---------------------------------------------------------------------------
// Evidência com escopo de alvo: partição, comparação e validação, nessa ordem
// (probes de nível superior).
// ---------------------------------------------------------------------------

// Evidência plana derivada de um fixture congelado, com releases e milestones
// injetadas. Nenhum SHA, identificador de execução ou identificador de release
// é retyped: tudo vem dos fixtures que já os carregam (D-08). Nomes de tag,
// números de milestone e contagens de issue dos cenários sintetizados são dados
// de cenário, não identificadores congelados.
function evidencia(base, { releases, milestones, closeMarkers } = {}) {
  return {
    target: { version: base.target.version, expectedSha: base.target.expectedSha },
    ci: clonar(base.ci),
    releases: releases ?? clonar(base.releases),
    milestones: milestones ?? clonar(base.milestones),
    closeMarkers: closeMarkers ?? clonar(base.closeMarkers),
  };
}

const tagAlheia = (base, sufixo) => `${base.target.version}${sufixo}`;

it('duas releases idênticas da versão pedida são DUPLICATE com os dois identificadores retidos', () => {
  const decisao = classifySnapshot(fixture('duplicate'));
  assert.equal(decisao.code, 'DUPLICATE');
  assert.deepEqual(decisao.releases.map((r) => r.id), [9001, 9002]);
  assert.equal(decisao.targetShaValidates, true);
  assert.equal(decisao.outcome, undefined);
  assert.equal(decisao.writeAction, null);
});

it('duas releases da versão pedida com alvos diferentes são CONFLICTING com os dois identificadores retidos', () => {
  const base = fixture('conflicting');
  const decisao = classifySnapshot(fixture('conflicting'));
  assert.equal(decisao.code, 'CONFLICTING');
  assert.deepEqual(decisao.releases.map((r) => r.id), [9001, 9003]);
  assert.equal(decisao.targetShaValidates, false);
  assert.equal(decisao.outcome, undefined);
  assert.ok(decisao.reason.includes(base.releases[0].targetSha));
  assert.ok(decisao.reason.includes(base.releases[1].targetSha));
});

it('o fixture conflicting congelado reporta CONFLICTING em vez de filtrar o registro divergente', () => {
  // A divergência de SHA alvo é o SINAL de comparação, nunca um filtro de
  // entrada: o registro que diverge continua na partição e continua visível.
  const decisao = classifySnapshot(fixture('conflicting'));
  assert.equal(decisao.code, 'CONFLICTING');
  assert.deepEqual(decisao.releases.map((r) => r.id), [9001, 9003]);
  assert.equal(decisao.targetShaValidates, false);
  assert.deepEqual(decisao.unrelatedReleases, []);
});

it('release única da versão pedida com SHA divergente fica na partição com targetShaValidates falso', () => {
  const base = fixture('conflicting');
  const decisao = classifySnapshot(evidencia(base, { releases: [clonar(base.releases[1])] }));
  assert.equal(decisao.code, 'PARTIAL');
  assert.deepEqual(decisao.releases.map((r) => r.id), [9003]);
  assert.equal(decisao.targetShaValidates, false);
  assert.ok(decisao.reason.includes(base.releases[1].targetSha));
  assert.equal(decisao.outcome, undefined);
});

it('duas releases de duas outras versões ficam fora da decisão do alvo e do motivo', () => {
  const decisao = classifySnapshot(fixture('unrelated'));
  assert.equal(decisao.code, 'MISSING');
  assert.equal(decisao.outcome, undefined);
  assert.deepEqual(decisao.releases, []);
  // Retenção ordenada por identificador, então a ordem observada é a dos ids
  // congelados, não a das tags.
  assert.deepEqual(decisao.unrelatedReleases.map((r) => r.id), [9001, 9003]);
  assert.deepEqual(decisao.unrelatedReleases.map((r) => r.tagName), ['v0.1.1-anterior', 'v0.1.0']);
  assert.equal(decisao.reason.includes('v0.1.0'), false);
  assert.equal(decisao.reason.includes('v0.1.1-anterior'), false);
  assert.equal(decisao.reason.includes('conflit'), false);
});

it('uma release de outra versão não decide o alvo quando existe uma release da versão pedida', () => {
  const base = fixture('conflicting');
  const alheia = { ...clonar(base.releases[1]), tagName: tagAlheia(base, '-anterior') };
  const decisao = classifySnapshot(
    evidencia(base, { releases: [clonar(base.releases[0]), alheia] }),
  );
  assert.equal(decisao.code, 'PARTIAL');
  assert.deepEqual(decisao.releases.map((r) => r.id), [9001]);
  assert.deepEqual(decisao.unrelatedReleases.map((r) => r.id), [9003]);
});

it('duas milestones da versão pedida são ambas retidas e o alvo continua em aberto', () => {
  const base = fixture('complete');
  const segunda = { ...clonar(base.milestones[0]), number: base.milestones[0].number + 1 };
  const decisao = classifySnapshot(
    evidencia(base, { milestones: [clonar(base.milestones[0]), segunda] }),
  );
  assert.equal(decisao.code, 'PARTIAL');
  assert.equal(decisao.outcome, undefined);
  assert.deepEqual(decisao.milestones.map((m) => m.number), [
    base.milestones[0].number,
    base.milestones[0].number + 1,
  ]);
  assert.deepEqual(decisao.milestones.map((m) => m.state), ['closed', 'closed']);
});

it('uma milestone de outra versão fica fora da decisão do alvo', () => {
  // A milestone do alvo está aberta, então o no-op não cabe; a milestone
  // alheia não pode entrar na partição nem aparecer entre as retidas.
  const base = fixture('complete');
  const alheia = {
    ...clonar(base.milestones[0]),
    number: base.milestones[0].number + 1,
    title: tagAlheia(base, '-anterior'),
  };
  const aberta = { ...clonar(base.milestones[0]), state: 'open', openIssues: 1 };
  const decisao = classifySnapshot(evidencia(base, { milestones: [aberta, alheia] }));
  assert.equal(decisao.code, 'PARTIAL');
  assert.equal(decisao.outcome, undefined);
  assert.deepEqual(decisao.milestones.map((m) => m.number), [base.milestones[0].number]);
  assert.deepEqual(decisao.unrelatedMilestones.map((m) => m.number), [
    base.milestones[0].number + 1,
  ]);
});

it('release publicada com milestone fechada sem issue aberta é MISSING com outcome COMPLETE_NOOP', () => {
  const decisao = classifySnapshot(fixture('complete'));
  assert.equal(decisao.code, 'MISSING');
  assert.equal(decisao.outcome, 'COMPLETE_NOOP');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.deepEqual(decisao.releases.map((r) => r.id), [9010]);
  assert.deepEqual(decisao.milestones.map((m) => m.number), [9004]);
  assert.equal(decisao.targetShaValidates, true);
  assert.ok(decisao.reason.length > 0);
});

it('release de rascunho para a versão pedida é PARTIAL sem outcome', () => {
  const decisao = classifySnapshot(fixture('partial'));
  assert.equal(decisao.code, 'PARTIAL');
  assert.equal(decisao.outcome, undefined);
  assert.deepEqual(decisao.releases.map((r) => r.id), [9000]);
});

it('milestone aberta com issue aberta é PARTIAL sem outcome', () => {
  const base = fixture('complete');
  const aberta = { ...clonar(base.milestones[0]), state: 'open', openIssues: 1 };
  const decisao = classifySnapshot(evidencia(base, { milestones: [aberta] }));
  assert.equal(decisao.code, 'PARTIAL');
  assert.equal(decisao.outcome, undefined);
});
