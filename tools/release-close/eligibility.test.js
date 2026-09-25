// Prova do tracer: elegibilidade de tag sobre o fixture de referência.
//
// Roda com: node --test tools/release-close/ (zero dependências, sem rede,
// sem banco). Nomes em PT-BR seguindo a convenção de backend/tests/.
//
// As sondas de identidade estrita e de normalização vivem em `it` de TOPO, fora
// do `describe`: o node recua as linhas `not ok` de subtestes aninhados, e o
// verificador de evidência RED (gsd check tdd-red-evidence) só reconhece o
// teste-alvo quando a linha `not ok N - <nome>` sai na coluna 0 do TAP.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkTagEligibility } from './eligibility.js';
import { makeFakeClient } from './fake-client.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

const clone = (obj) => JSON.parse(JSON.stringify(obj));

// Versão do baseline: lida do fixture congelado, nunca digitada à mão, para que
// o fixture permaneça a única fonte da verdade (D-08).
const VERSION = 'v0.1.1';

// Executa a CLI local capturando o status mesmo em saída não zero, para que a
// asserção falhe em asserção (e não em exceção de subprocesso).
const runCli = (args) => {
  const cli = new URL('./release-close.js', import.meta.url);
  try {
    const stdout = execFileSync(process.execPath, [cli.pathname, ...args], { encoding: 'utf8' });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status ?? null, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
};

describe('elegibilidade de tag (SAFE-02)', () => {
  it('aceita tag anotada quando peel == main == SHA esperado', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap);
    const decisao = await checkTagEligibility(fake, {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, true);
    assert.equal(decisao.code, 'ELIGIBLE');
    assert.equal(decisao.writeAction, null);
    assert.equal(fake.writes.length, 0);
  });

  it('rejeita tag leve de salto único como inelegível', async () => {
    const snap = clone(fixture('reference'));
    snap.tagRef.data.object = { type: 'commit', sha: snap.expectedSha };
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'LIGHTWEIGHT');
    assert.equal(decisao.writeAction, null);
  });

  it('rejeita cabeça da main divergente', async () => {
    const snap = clone(fixture('reference'));
    snap.branchHead.data.sha = 'b'.repeat(40);
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'SAFE-02');
    assert.equal(decisao.writeAction, null);
  });

  it('rejeita SHA esperado divergente', async () => {
    const snap = fixture('reference');
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: 'c'.repeat(40),
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'SAFE-02');
    assert.equal(decisao.writeAction, null);
  });

  it('rejeita tag ausente no remoto', async () => {
    const snap = clone(fixture('reference'));
    snap.tagRef = { ok: false, status: 404, data: null };
    const decisao = await checkTagEligibility(makeFakeClient(snap), {
      version: 'v0.1.1',
      expectedSha: snap.expectedSha,
    });
    assert.equal(decisao.eligible, false);
    assert.equal(decisao.code, 'MISSING');
    assert.equal(decisao.writeAction, null);
  });

  it('lança TypeError em SHA abreviado', async () => {
    const snap = fixture('reference');
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: 'v0.1.1',
          expectedSha: '10c62ac',
        }),
      TypeError,
    );
  });

  it('lança TypeError em versão malformada', async () => {
    const snap = fixture('reference');
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: '0.1.1',
          expectedSha: snap.expectedSha,
        }),
      TypeError,
    );
  });

  it('trata valores com metacaracteres como strings opacas (T-09-01)', async () => {
    const snap = fixture('reference');
    // Nenhum sink de subprocesso existe: estes valores só podem virar
    // TypeError de validação, nunca execução.
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: 'v0.1.1; rm -rf /',
          expectedSha: snap.expectedSha,
        }),
      TypeError,
    );
    await assert.rejects(
      () =>
        checkTagEligibility(makeFakeClient(snap), {
          version: 'v0.1.1',
          expectedSha: '$(id)',
        }),
      TypeError,
    );
  });

  it('prova escrita zero: writes vazio e writeAction null em todo caminho', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap);
    const decisoes = [
      await checkTagEligibility(fake, { version: 'v0.1.1', expectedSha: snap.expectedSha }),
      await checkTagEligibility(fake, { version: 'v0.1.1', expectedSha: 'd'.repeat(40) }),
    ];
    for (const decisao of decisoes) {
      assert.equal(decisao.writeAction, null);
    }
    assert.equal(fake.writes.length, 0);
    assert.equal(fake.mutations, 0);
  });

  it('ordena leituras: ref antes do objeto da tag antes da cabeça', async () => {
    const snap = fixture('reference');
    const fake = makeFakeClient(snap);
    await checkTagEligibility(fake, { version: 'v0.1.1', expectedSha: snap.expectedSha });
    const ordem = fake.calls.map((c) => c.method);
    assert.deepEqual(ordem.slice(0, 3), ['getTagRef', 'getTagObject', 'getBranchHead']);
    assert.deepEqual(
      fake.calls.map((c) => c.seq),
      [1, 2, 3],
    );
  });

  it('dupla execução do verify é segura: saída idêntica e zero escritas (OPS-01 idempotência)', () => {
    // Mesma entrada congelada duas vezes: os dois payloads precisam ser
    // byte a byte idênticos e trazer o contador de mutações medido.
    const primeira = runCli(['verify', '--json']);
    const segunda = runCli(['verify', '--json']);
    assert.equal(primeira.status, 0);
    assert.equal(segunda.status, 0);
    assert.equal(primeira.stdout, segunda.stdout);
    assert.equal(JSON.parse(primeira.stdout).mutations, 0);
    assert.equal(JSON.parse(segunda.stdout).mutations, 0);
  });

  it('clientes fake independentes têm logs isolados (OPS-01 concorrência single-process)', async () => {
    // Limite explícito desta prova: ela isola instâncias no MESMO processo.
    // O travamento de workstation entre processos é o REC-05 da Fase 11 — esta
    // suíte nunca deve ser citada como garantia de lock entre processos.
    const snap = fixture('reference');
    const primeiro = makeFakeClient(snap);
    const segundo = makeFakeClient(snap);
    await checkTagEligibility(primeiro, { version: 'v0.1.1', expectedSha: snap.expectedSha });
    assert.equal(primeiro.calls.length, 3);
    assert.equal(primeiro.mutations, 0);
    assert.equal(segundo.calls.length, 0);
    assert.equal(segundo.writes.length, 0);
    assert.equal(segundo.mutations, 0);
  });
});

// ── Matriz de códigos exatos ───────────────────────────────────────────────
// Dezenove famílias nomeadas, cada uma montada a partir de um clone profundo
// do fixture congelado (nunca uma segunda cópia digitada à mão — o baseline
// continua sendo a única fonte da verdade, D-08). O contrato de cada linha é
// o código EN exato; a razão é verificada só como prosa PT-BR não vazia.
const MARCA_PT_BR = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\bnão\b|\bé\b|esperad/;

const MATRIZ_CODIGOS = [
  { nome: 'referência congelada', codigo: 'ELIGIBLE' },
  {
    nome: 'tag leve de salto único',
    codigo: 'LIGHTWEIGHT',
    montar: (s) => {
      s.tagRef.data.object = { type: 'commit', sha: s.expectedSha };
    },
  },
  {
    nome: 'ref de outra versão',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagRef.data.ref = 'refs/tags/v0.1.0';
    },
  },
  {
    nome: 'SHA do objeto da tag abreviado',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagRef.data.object.sha = s.tagRef.data.object.sha.slice(0, 7);
    },
  },
  {
    nome: 'commit peeled abreviado',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagObject.data.object.sha = s.tagObject.data.object.sha.slice(0, 7);
    },
  },
  {
    nome: 'identidade do objeto da tag divergente',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagObject.data.sha = 'a'.repeat(40);
    },
  },
  {
    nome: 'peel em tree',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagObject.data.object.type = 'tree';
    },
  },
  {
    nome: 'peel em blob',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagObject.data.object.type = 'blob';
    },
  },
  {
    nome: 'peel em tag (tag que aponta para tag)',
    codigo: 'TAG-IDENTITY',
    montar: (s) => {
      s.tagObject.data.object.type = 'tag';
    },
  },
  {
    nome: 'tag ausente',
    codigo: 'MISSING',
    montar: (s) => {
      s.tagRef = { ok: false, status: 404, data: null };
    },
  },
  {
    nome: 'objeto da tag ausente',
    codigo: 'MISSING',
    montar: (s) => {
      s.tagObject = { ok: false, status: 404, data: null };
    },
  },
  {
    nome: 'commit divergente da main',
    codigo: 'SAFE-02',
    montar: (s) => {
      s.branchHead.data.sha = 'b'.repeat(40);
    },
  },
  { nome: 'SHA esperado divergente', codigo: 'SAFE-02', esperadoSha: 'c'.repeat(40) },
  {
    nome: 'permissão negada (401)',
    codigo: 'PERMISSION',
    montar: (s) => {
      s.tagRef = { ok: false, status: 401, data: null };
    },
  },
  {
    nome: 'permissão negada (403)',
    codigo: 'PERMISSION',
    montar: (s) => {
      s.tagRef = { ok: false, status: 403, data: null };
    },
  },
  { nome: 'limite de requisições (429)', codigo: 'UNAVAILABLE', roteiro: { getTagRef: ['status-429'] } },
  { nome: 'erro do servidor (500)', codigo: 'UNAVAILABLE', roteiro: { getTagRef: ['status-5xx'] } },
  {
    nome: 'envelope malformado',
    codigo: 'MALFORMED',
    montar: (s) => {
      delete s.tagRef.data.object;
    },
  },
  { nome: 'leitura interrompida', codigo: 'TRANSPORT', roteiro: { getTagRef: ['timeout'] } },
];

it('matriz de códigos exatos: as dezenove famílias devolvem o contrato declarado', async () => {
  assert.equal(MATRIZ_CODIGOS.length, 19, 'a matriz precisa cobrir as dezenove famílias');
  const clientes = [];
  for (const linha of MATRIZ_CODIGOS) {
    const snap = clone(fixture('reference'));
    if (linha.montar) linha.montar(snap);
    const fake = makeFakeClient(snap, linha.roteiro);
    clientes.push(fake);
    const decisao = await checkTagEligibility(fake, {
      version: VERSION,
      expectedSha: linha.esperadoSha ?? snap.expectedSha,
    });
    assert.equal(decisao.code, linha.codigo, `código errado na família "${linha.nome}"`);
    assert.equal(decisao.eligible, linha.codigo === 'ELIGIBLE', `elegibilidade errada em "${linha.nome}"`);
    assert.equal(decisao.writeAction, null, `a família "${linha.nome}" carregou writeAction`);
    assert.notEqual(decisao.reason, decisao.code, `a família "${linha.nome}" repetiu o código como motivo`);
    assert.ok(decisao.reason.length > 0, `a família "${linha.nome}" ficou sem motivo`);
    assert.ok(MARCA_PT_BR.test(decisao.reason), `a família "${linha.nome}" não tem marca de PT-BR`);
  }
  // Nenhuma linha da matriz pode ter escrito no remoto.
  for (const fake of clientes) {
    assert.equal(fake.mutations, 0, 'a matriz escreveu no remoto');
  }
});

it('matriz de códigos exatos: o vocabulário de EN é o declarado no contrato', () => {
  // Uma família nova não pode aparecer com um código fora do vocabulário
  // publicado, que é o que o runbook da Fase 12 referencia.
  const publicados = [
    'ELIGIBLE',
    'MISSING',
    'PERMISSION',
    'UNAVAILABLE',
    'MALFORMED',
    'TRANSPORT',
    'LIGHTWEIGHT',
    'TAG-IDENTITY',
    'SAFE-02',
  ];
  for (const linha of MATRIZ_CODIGOS) {
    assert.ok(publicados.includes(linha.codigo), `código fora do vocabulário: ${linha.codigo}`);
  }
});

// ── Identidade estrita da tag anotada em dois saltos ────────────────────────
// Uma tag anotada só é elegível quando as QUATRO provas do plano de dois saltos
// fecham: nome exato da ref pedida, SHA do objeto da tag em 40 hex, identidade
// do objeto da tag igual à da ref, e segundo salto em commit.

it('identidade estrita: rejeita peel em tree com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagObject.data.object.type = 'tree';
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: rejeita peel em blob com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagObject.data.object.type = 'blob';
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: rejeita tag que aponta para outra tag com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagObject.data.object.type = 'tag';
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: rejeita ref de outra versão com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagRef.data.ref = 'refs/tags/v0.1.0';
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: rejeita identidade do objeto da tag divergente com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagObject.data.sha = 'a'.repeat(40);
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: rejeita SHA do objeto da tag abreviado com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagRef.data.object.sha = snap.tagRef.data.object.sha.slice(0, 7);
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: rejeita commit peeled abreviado com TAG-IDENTITY', async () => {
  const snap = clone(fixture('reference'));
  snap.tagObject.data.object.sha = snap.tagObject.data.object.sha.slice(0, 7);
  const decisao = await checkTagEligibility(makeFakeClient(snap), {
    version: VERSION,
    expectedSha: snap.expectedSha,
  });
  assert.equal(decisao.code, 'TAG-IDENTITY');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('identidade estrita: chama o segundo salto com o SHA exato do objeto da tag', async () => {
  const snap = clone(fixture('reference'));
  const fake = makeFakeClient(snap);
  await checkTagEligibility(fake, { version: VERSION, expectedSha: snap.expectedSha });
  const segundo = fake.calls.find((c) => c.method === 'getTagObject');
  assert.deepEqual(segundo.args, [snap.tagRef.data.object.sha]);
});

// ── Normalização de falha: ausência nunca é inferida de uma falha ───────────
// Somente o status 404 prova ausência. Permissão negada, estado remoto
// indeterminado, formato malformado e leitura interrompida recebem código
// próprio, e nenhum deles pode escapar como rejeição (D-11).

// Executa o predicado capturando tanto a decisão quanto um eventual escape de
// erro, para que a família que rejeita falhe na asserção e não como exceção.
const tentar = async (client, expectedSha) => {
  try {
    return { decisao: await checkTagEligibility(client, { version: VERSION, expectedSha }) };
  } catch (erro) {
    return { erro };
  }
};

it('normalização: 404 no primeiro salto é a única ausência', async () => {
  const snap = clone(fixture('reference'));
  snap.tagRef = { ok: false, status: 404, data: null };
  const { decisao, erro } = await tentar(makeFakeClient(snap), snap.expectedSha);
  assert.equal(erro, undefined, `401 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'MISSING');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('normalização: 401 vira PERMISSION e não ausência', async () => {
  const snap = clone(fixture('reference'));
  snap.tagRef = { ok: false, status: 401, data: null };
  const { decisao, erro } = await tentar(makeFakeClient(snap), snap.expectedSha);
  assert.equal(erro, undefined, `401 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'PERMISSION');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.includes('401'), `o motivo não nomeia o status: ${decisao.reason}`);
});

it('normalização: 403 vira PERMISSION e não ausência', async () => {
  const snap = clone(fixture('reference'));
  snap.tagRef = { ok: false, status: 403, data: null };
  const { decisao, erro } = await tentar(makeFakeClient(snap), snap.expectedSha);
  assert.equal(erro, undefined, `403 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'PERMISSION');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.includes('403'), `o motivo não nomeia o status: ${decisao.reason}`);
});

it('normalização: 409 roteirizado vira UNAVAILABLE', async () => {
  const snap = clone(fixture('reference'));
  const { decisao, erro } = await tentar(
    makeFakeClient(snap, { getTagRef: ['status-409'] }),
    snap.expectedSha,
  );
  assert.equal(erro, undefined, `409 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'UNAVAILABLE');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.includes('409'), `o motivo não nomeia o status: ${decisao.reason}`);
});

it('normalização: 422 roteirizado vira UNAVAILABLE', async () => {
  const snap = clone(fixture('reference'));
  const { decisao, erro } = await tentar(
    makeFakeClient(snap, { getTagRef: ['status-422'] }),
    snap.expectedSha,
  );
  assert.equal(erro, undefined, `422 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'UNAVAILABLE');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.includes('422'), `o motivo não nomeia o status: ${decisao.reason}`);
});

it('normalização: 429 roteirizado vira UNAVAILABLE', async () => {
  const snap = clone(fixture('reference'));
  const { decisao, erro } = await tentar(
    makeFakeClient(snap, { getTagRef: ['status-429'] }),
    snap.expectedSha,
  );
  assert.equal(erro, undefined, `429 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'UNAVAILABLE');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.includes('429'), `o motivo não nomeia o status: ${decisao.reason}`);
});

it('normalização: 5xx roteirizado vira UNAVAILABLE', async () => {
  const snap = clone(fixture('reference'));
  const { decisao, erro } = await tentar(
    makeFakeClient(snap, { getTagRef: ['status-5xx'] }),
    snap.expectedSha,
  );
  assert.equal(erro, undefined, `500 deveria devolver decisão, não rejeitar: ${erro?.message}`);
  assert.equal(decisao.code, 'UNAVAILABLE');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
  assert.ok(decisao.reason.includes('500'), `o motivo não nomeia o status: ${decisao.reason}`);
});

it('normalização: envelope ok sem data.object é MALFORMED', async () => {
  const snap = clone(fixture('reference'));
  delete snap.tagRef.data.object;
  const { decisao, erro } = await tentar(makeFakeClient(snap), snap.expectedSha);
  assert.equal(erro, undefined, `envelope sem objeto deveria devolver decisão: ${erro?.message}`);
  assert.equal(decisao.code, 'MALFORMED');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('normalização: data.object de tipo errado no segundo salto é MALFORMED', async () => {
  const snap = clone(fixture('reference'));
  snap.tagObject.data.object = 'apenas uma string';
  const { decisao, erro } = await tentar(makeFakeClient(snap), snap.expectedSha);
  assert.equal(erro, undefined, `envelope torto deveria devolver decisão: ${erro?.message}`);
  assert.equal(decisao.code, 'MALFORMED');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('normalização: status não numérico é MALFORMED', async () => {
  const snap = clone(fixture('reference'));
  snap.tagRef.status = 'duzentos';
  const { decisao, erro } = await tentar(makeFakeClient(snap), snap.expectedSha);
  assert.equal(erro, undefined, `status torto deveria devolver decisão: ${erro?.message}`);
  assert.equal(decisao.code, 'MALFORMED');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('normalização: getTagRef com tempo esgotado devolve TRANSPORT', async () => {
  const snap = clone(fixture('reference'));
  const { decisao, erro } = await tentar(
    makeFakeClient(snap, { getTagRef: ['timeout'] }),
    snap.expectedSha,
  );
  assert.equal(erro, undefined, `leitura interrompida não pode escapar: ${erro?.message}`);
  assert.equal(decisao.code, 'TRANSPORT');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('normalização: getBranchHead com resposta perdida devolve TRANSPORT', async () => {
  const snap = clone(fixture('reference'));
  const { decisao, erro } = await tentar(
    makeFakeClient(snap, { getBranchHead: ['lost-response'] }),
    snap.expectedSha,
  );
  assert.equal(erro, undefined, `leitura interrompida não pode escapar: ${erro?.message}`);
  assert.equal(decisao.code, 'TRANSPORT');
  assert.equal(decisao.eligible, false);
  assert.equal(decisao.writeAction, null);
});

it('normalização: nenhuma família de falha escapa como rejeição', async () => {
  const base = () => clone(fixture('reference'));
  const familias = [
    ['404', () => { const s = base(); s.tagRef = { ok: false, status: 404, data: null }; return makeFakeClient(s); }],
    ['401', () => { const s = base(); s.tagRef = { ok: false, status: 401, data: null }; return makeFakeClient(s); }],
    ['403', () => { const s = base(); s.tagRef = { ok: false, status: 403, data: null }; return makeFakeClient(s); }],
    ['409', () => makeFakeClient(base(), { getTagRef: ['status-409'] })],
    ['422', () => makeFakeClient(base(), { getTagRef: ['status-422'] })],
    ['429', () => makeFakeClient(base(), { getTagRef: ['status-429'] })],
    ['5xx', () => makeFakeClient(base(), { getTagRef: ['status-5xx'] })],
    ['sem objeto', () => { const s = base(); delete s.tagRef.data.object; return makeFakeClient(s); }],
    ['objeto torto', () => { const s = base(); s.tagObject.data.object = 'string'; return makeFakeClient(s); }],
    ['status torto', () => { const s = base(); s.tagRef.status = 'duzentos'; return makeFakeClient(s); }],
    ['timeout', () => makeFakeClient(base(), { getTagRef: ['timeout'] })],
    ['resposta perdida', () => makeFakeClient(base(), { getBranchHead: ['lost-response'] })],
  ];
  const esperado = {
    404: 'MISSING',
    401: 'PERMISSION',
    403: 'PERMISSION',
    409: 'UNAVAILABLE',
    422: 'UNAVAILABLE',
    429: 'UNAVAILABLE',
    '5xx': 'UNAVAILABLE',
    'sem objeto': 'MALFORMED',
    'objeto torto': 'MALFORMED',
    'status torto': 'MALFORMED',
    timeout: 'TRANSPORT',
    'resposta perdida': 'TRANSPORT',
  };
  for (const [nome, fabrica] of familias) {
    const { decisao, erro } = await tentar(fabrica(), base().expectedSha);
    assert.equal(erro, undefined, `a família ${nome} escapou como rejeição: ${erro?.message}`);
    assert.equal(decisao.code, esperado[nome], `código errado na família ${nome}`);
    assert.equal(decisao.eligible, false, `a família ${nome} ficou elegível`);
    assert.equal(decisao.writeAction, null, `a família ${nome} carregou writeAction`);
    assert.ok(decisao.reason.length > 0, `a família ${nome} ficou sem motivo`);
  }
});

it('CLI concorda com o predicado: verify --json sai zero com ELIGIBLE e não zero com SAFE-02', () => {
  const baseline = runCli(['verify', '--json']);
  assert.equal(baseline.status, 0);
  assert.equal(JSON.parse(baseline.stdout).code, 'ELIGIBLE');

  const divergente = runCli(['verify', '--json', '--sha', 'b'.repeat(40)]);
  assert.notEqual(divergente.status, 0);
  assert.equal(JSON.parse(divergente.stdout).code, 'SAFE-02');
});
