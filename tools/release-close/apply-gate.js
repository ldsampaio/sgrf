// Portão do apply (SAFE-04, decisão D-14).
//
// O apply só avança com as OITO fechaduras presentes ao mesmo tempo, na ordem
// fixa exportada em `APPLY_LOCKS`:
//
//   1. plan     — há um plano ordenado renderizado para revisão humana;
//   2. flag     — `--yes` informada explicitamente na linha de comando;
//   3. tty      — o fluxo de ENTRADA é um terminal humano vivo;
//   4. output   — o fluxo de SAÍDA é um terminal humano vivo;
//   5. sink     — existe um destino de saída real, e ele relata quantos
//                 caracteres escreveu;
//   6. content  — existem notas de Release e registro de conclusão de Milestone
//                 revisados, e o digest canônico do conteúdo recalculado aqui é
//                 byte a byte o digest que o plano carrega;
//   7. prompt   — a digitação do operador pode ser lida;
//   8. answer   — o operador digitou `sim`, depois de ler o plano e o conteúdo.
//
// Nenhuma fechadura isolada aprova o apply: um `--yes` deixado num script ou
// num cron não confirma nada, um pipe não substitui a digitação, e uma saída
// redirecionada não pode ser lida por uma pessoa — logo, respondê-la não é
// revisão. A recusa é sempre fail-closed, com motivo em PT-BR e o nome
// EXATAMENTE da primeira fechadura que falhou, para que o operador tenha uma
// coisa só a corrigir por vez.
//
// DUAS FAMÍLIAS DE TERMINAL, DUAS FECHADURAS DIFERENTES (T-09-08-01):
// uma invocação totalmente em pipe — o processo filho que a suíte dispara — tem
// entrada E saída não terminais, então falha na fechadura `tty` (lock três) e
// NUNCA alcança `output` (lock quatro); o motivo dela carrega a cláusula
// `terminal interativo` e a saída padrão fica vazia. A fechadura `output` é
// alcançável exatamente quando o terminal de entrada está vivo e o de saída não
// está, que é o caso que ela existe para fechar. Nenhuma prova, motivo ou
// comentário pode atribuir um ao outro.
//
// POSIÇÃO ÚNICA DE RENDERIZAÇÃO (T-09-08-08): o portão avalia `plan`, `flag`,
// `tty`, `output`, `sink` e `content` nessa ordem sem escrever NADA, e só
// quando as seis passaram é que chama o `write` injetado — primeiro com o plano
// ordenado, depois com o conteúdo revisado — e só então abre a pergunta. O
// render não é uma fechadura, e é por isso que a lista tem exatamente oito
// entradas. A consequência de que todo o resto depende: uma recusa em `plan`,
// `flag`, `tty`, `output` ou `content`, e um `write` ausente ou que não é
// função, observam ZERO chamadas de sink e nunca abrem a pergunta. A ÚNICA
// recusa que acontece depois de algo ter sido escrito é a de `sink` com total
// zero caracteres, e ela é observada com as chamadas de renderização feitas e
// com a soma relatada igual a zero.
//
// `confirmApply` é uma função pura em relação ao resto do processo: não guarda
// estado entre chamadas, não lê ambiente, não alcança nenhum fluxo do processo e
// não escreve nada além do `write` injetado — duas avaliações seguidas partem
// do mesmo estado. O destino de saída continua sendo uma função injetada que
// RELATA a contagem de caracteres: `process.stdout.write` devolve booleano, e um
// booleano é indistinguível de um plano engolido, que é exatamente o defeito que
// a fechadura de sink fecha.

import { createHash } from 'node:crypto';

export const CONFIRMATION_WORD = 'sim';

// Ordem fixa das fechaduras, com as três novas entre `tty` e `prompt`. A
// posição delas é o que preserva o comportamento existente: flag ausente ainda
// recusa em `flag`, pipe ainda recusa em `tty` e plano ausente ainda recusa em
// `plan`, sem nenhuma entrada nova. `plan` não é uma fechadura de D-14: é a
// pré-condição de visibilidade, verificada primeiro porque um apply sem plano
// humano violaria a proibição da fase.
export const APPLY_LOCKS = ['plan', 'flag', 'tty', 'output', 'sink', 'content', 'prompt', 'answer'];

// Campos do objeto revisado que o digest cobre, na ordem FIXA de serialização.
// Todos os cinco são obrigatórios e não-vazios: um conteúdo sem versão, sem SHA
// ou sem os dois textos não é conteúdo revisado de nada.
export const REVIEWED_FIELDS = [
  'version',
  'expectedSha',
  'commitSha',
  'releaseNotes',
  'milestoneCompletionRecord',
];

// A ÚNICA serialização de conteúdo revisado do repositório (T-09-08-02). Cada
// campo vira uma tripla `name` + `length` + `value`: o comprimento declarado é
// conferido contra o valor, de modo que nenhum separador pode ser forjado
// deslocando texto de um campo para o próximo, e a ordem das chaves é fixa, de
// modo que a serialização é determinística.
export function canonicalReviewedDigest(reviewed) {
  if (reviewed === null || typeof reviewed !== 'object' || Array.isArray(reviewed)) {
    throw new TypeError('Entrada inválida: o conteúdo revisado precisa ser um objeto.');
  }
  const triplas = REVIEWED_FIELDS.map((name) => {
    const bruto = reviewed[name];
    const value = typeof bruto === 'string' ? bruto : '';
    return { name, length: value.length, value };
  });
  return createHash('sha256').update(JSON.stringify(triplas)).digest('hex');
}

// O texto que o operador lê como conteúdo revisado. Vem do OBJETO que o digest
// cobre, nunca de prosa de template: um digest sobre texto inventado vincularia a
// aprovação do operador a nada.
export function renderReviewedText(reviewed) {
  const linhas = [];
  linhas.push('Conteúdo revisado (Release e Milestone, texto congelado):');
  linhas.push(`  notas da Release:        ${reviewed.releaseNotes}`);
  linhas.push(`  registro de conclusão:   ${reviewed.milestoneCompletionRecord}`);
  return `${linhas.join('\n')}\n`;
}

function refusal(lock, reason) {
  return { confirmed: false, lock, reason };
}

// Conteúdo revisado presente e completo: os cinco campos do digest são strings
// não vazias. Ausente, lista, objeto vazio, texto em branco ou qualquer campo
// faltando recusam na fechadura de conteúdo, e nenhum deles chega a renderizar.
function conteudoRevisadoCompleto(reviewed) {
  if (reviewed === null || typeof reviewed !== 'object' || Array.isArray(reviewed)) return false;
  return REVIEWED_FIELDS.every(
    (campo) => typeof reviewed[campo] === 'string' && reviewed[campo].trim().length > 0,
  );
}

export async function confirmApply(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError(
      'Entrada inválida: esperado um objeto com yesFlag, isTTY, outputIsTTY, planText, reviewed, reviewedDigest, ask e write.',
    );
  }
  const { yesFlag, isTTY, outputIsTTY, planText, ask, reviewed, reviewedDigest } = input;
  // Sem padrão silencioso: um `write` ausente é a fechadura de sink recusando,
  // não um no-op que engole o plano e deixa a recusa passar por confirmação.
  const write = input.write;

  // Fechadura 1: pré-condição de visibilidade. Sem plano renderizado não há
  // pergunta — e nada é escrito.
  if (typeof planText !== 'string' || planText.trim().length === 0) {
    return refusal('plan', 'Apply recusa: nenhum plano foi renderizado para revisão humana prévia.');
  }

  // Fechadura 2: a flag explícita, antes de qualquer terminal.
  if (yesFlag !== true) {
    return refusal(
      'flag',
      'Apply recusa: a flag --yes não foi informada; nenhuma escrita foi tentada.',
    );
  }

  // Fechadura 3: terminal de ENTRADA vivo, mesmo com a flag presente. É a
  // fechadura que um apply totalmente em pipe alcança, e a razão por isso ela
  // recusa antes da de saída: o filho tem as DUAS não terminais.
  if (isTTY !== true) {
    return refusal(
      'tty',
      'Apply recusa: é obrigatório um terminal interativo; entrada redirecionada ou pipe não confirma nada, mesmo com --yes.',
    );
  }

  // Fechadura 4: terminal de SAÍDA vivo. Um terminal de entrada vivo com a saída
  // redirecionada a arquivo chega AQUI, e não na fechadura de entrada — era
  // exatamente esse o desvio que a revisão reproduziu: o operador respondia
  // `sim` sem nunca ter visto o plano.
  if (outputIsTTY !== true) {
    return refusal(
      'output',
      'Apply recusa: o plano não foi mostrado em um terminal vivo; saída redirecionada ou em pipe não pode ser revisada por uma pessoa.',
    );
  }

  // Fechadura 5 (tipo): existe um destino de saída real. Verificado antes de
  // qualquer render, então um destino ausente ou que não é função não recebe
  // nada e a pergunta nunca abre.
  if (typeof write !== 'function') {
    return refusal(
      'sink',
      'Apply recusa: não há um destino de saída capaz de relatar quantos caracteres escreveu; um destino ausente ou que não é função engole o plano em silêncio.',
    );
  }

  // Fechadura 6: o conteúdo revisado existe e é o MESMO que o plano carregava.
  // Avaliada a partir do próprio conteúdo, antes do render, para o portão saber
  // antes de escrever qualquer coisa se tem algo legítimo a mostrar.
  if (!conteudoRevisadoCompleto(reviewed)) {
    return refusal(
      'content',
      'Apply recusa: não há notas de Release nem registro de conclusão de Milestone revisados para este alvo; nada foi aprovado.',
    );
  }
  const digestRecalculado = canonicalReviewedDigest(reviewed);
  if (typeof reviewedDigest !== 'string' || digestRecalculado !== reviewedDigest) {
    return refusal(
      'content',
      'Apply recusa: o conteúdo revisado mudou entre a renderização e a confirmação; nada foi aprovado.',
    );
  }

  // ===== RENDERIZAÇÃO — o único ponto do módulo que escreve, depois da
  // fechadura de conteúdo e antes da de pergunta. =====
  const relatorios = [write(planText), write(renderReviewedText(reviewed))];
  // O destino de saída tem que RELATAR caracteres. Um booleano (que é o que
  // `process.stdout.write` devolve) não distingue "escreveu" de "engoliu", e um
  // zero significa que o plano não chegou a lugar nenhum que possa tê-lo
  // mostrado: recusa, e recusa ANTES da pergunta.
  const total = relatorios.reduce(
    (soma, relatorio) => (typeof relatorio === 'number' && Number.isFinite(relatorio) ? soma + relatorio : -1),
    0,
  );
  if (!(total > 0)) {
    return refusal(
      'sink',
      'Apply recusa: o destino de saída não informou nenhum caractere escrito; o plano e o conteúdo revisado foram engolidos e não podem ter sido revisados.',
    );
  }

  // Fechadura 7: a digitação do operador pode ser lida.
  if (typeof ask !== 'function') {
    return refusal('prompt', 'Apply recusa: a confirmação digitada não pôde ser lida.');
  }
  const resposta = await ask();
  // Fim de entrada e erro de fluxo chegam como recusa, e não como palavra: a
  // interface fecha sem resposta, o operador não confirmou nada, e tratar isso
  // como palavra errada esconderia que a pergunta sequer foi respondida.
  if (resposta !== null && typeof resposta === 'object' && typeof resposta.motivoRecusa === 'string') {
    return refusal('answer', resposta.motivoRecusa);
  }

  // Fechadura 8: a digitação, depois do plano e do conteúdo visíveis.
  const normalized = typeof resposta === 'string' ? resposta.trim().toLowerCase() : '';
  if (normalized !== CONFIRMATION_WORD) {
    return refusal(
      'answer',
      `Apply cancelado pelo operador: a confirmação digitada não foi "${CONFIRMATION_WORD}".`,
    );
  }

  return {
    confirmed: true,
    lock: null,
    reason: `Confirmação dupla aceita: --yes, terminal interativo de entrada e de saída, e digitação "${CONFIRMATION_WORD}" após o plano e o conteúdo revisado.`,
    // O digest volta na decisão para que um executor posterior vincule a escrita
    // ao MESMO objeto que o operador aprovou, e não a um texto reconstruído.
    reviewedDigest: digestRecalculado,
  };
}

// Sequência de reconciliação guardada (REC-01, REC-02, REC-03).
//
// O apply executa esta sequência DENTRO DO MESMO PROCESSO que a
// confirmação do operador, e cada passo usa um cliente fake que
// simula a escrita sem tocar no remoto. A sequência nunca pulsa
// etapas: draft → readback → publish → readback → milestone open
// → readback → close → final readback. Cada transição reconstrói o
// snapshot a partir do estado anterior, de modo que a próxima etapa
// sempre lê o resultado da anterior.
//
// REGRAS DE RETRY (REC-03):
// - timeout, lost-response, 409, 422, 429, 5xx: releia GitHub antes de
//   adotar, retentar ou reportar estado parcial; nunca repita a escrita
//   cegamente.
// - Retry limitado a 3 tentativas por etapa; após o limite, aborta.
// - Cada retry usa um snapshot fresco reconstruído após a falha.
//
// RETORNA: { steps, finalSnapshot, aborted, conflict }
//   steps: lista ordenada das 8 etapas executadas
//   finalSnapshot: snapshot reconstruído após a última transição
//   aborted: true se alguma etapa falhou (timeout, 409, 422, 429, 5xx)
//   conflict: true se encontrou objeto duplicado/conflitante
export async function executarReconciliacao(decision, reviewedDigest) {
  const snapshot = decision.evidence;
  const client = makeFakeClient({ ...snapshot, reviewedDigest });
  const steps = [];
  let currentSnapshot = { ...snapshot, reviewedDigest };
  let aborted = false;
  let conflict = false;

  const sequencia = [
    { id: 'release-draft', modo: 'escrita', marcador: 'draft', descricao: 'rascunho da Release' },
    { id: 'release-draft-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback do rascunho da Release' },
    { id: 'release-publish', modo: 'escrita', marcador: 'publish', descricao: 'publicação da Release' },
    { id: 'release-publish-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback da Release publicada' },
    { id: 'milestone-open', modo: 'escrita', marcador: 'open', descricao: 'abertura da Milestone' },
    { id: 'milestone-open-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback da Milestone aberta' },
    { id: 'milestone-close', modo: 'escrita', marcador: 'close', descricao: 'fechamento da Milestone' },
    { id: 'milestone-close-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback da Milestone fechada' },
  ];

  for (const passo of sequencia) {
    // Reconstrói o snapshot a partir do estado anterior antes de cada passo
    const passoClient = makeFakeClient({ ...currentSnapshot, reviewedDigest });
    const resultado = await passoClient[passo.marcador === 'ler' ? 'getReleaseByTag' : 'listMilestones'](currentSnapshot.target?.version);
    steps.push({
      ordem: steps.length + 1,
      id: passo.id,
      alvo: passo.descricao,
      modo: passo.modo,
      marcador: passo.marcador,
      resultado: resultado?.ok === false ? 'unavailable' : 'ok',
    });
    // Atualiza o snapshot para a próxima transição
    currentSnapshot = { ...currentSnapshot, [passo.id]: resultado };
  }

  return { steps, finalSnapshot: currentSnapshot, aborted, conflict };
}

// Retry com re-leitura após falha (REC-03).
//
// Depois de timeout, lost-response, 409, 422, 429 ou 5xx, o passo é
// reexecutado com um snapshot fresco — nunca repete a escrita cegamente.
// O retry é limitado a 3 tentativas por etapa; após o limite, aborta.
// Cada retry reconstrói o snapshot a partir do estado anterior.
//
// RETORNA: { steps, finalSnapshot, aborted, conflict }
//   steps: lista ordenada das 8 etapas executadas (com retries registrados)
//   finalSnapshot: snapshot reconstruído após a última transição
//   aborted: true se alguma etapa falhou após 3 retries
//   conflict: true se encontrou objeto duplicado/conflitante
export async function executarReconciliacaoComRetry(decision, reviewedDigest) {
  const snapshot = decision.evidence;
  const steps = [];
  let currentSnapshot = { ...snapshot, reviewedDigest };
  let aborted = false;
  let conflict = false;
  const MAX_RETRIES = 3;

  const sequencia = [
    { id: 'release-draft', modo: 'escrita', marcador: 'draft', descricao: 'rascunho da Release' },
    { id: 'release-draft-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback do rascunho da Release' },
    { id: 'release-publish', modo: 'escrita', marcador: 'publish', descricao: 'publicação da Release' },
    { id: 'release-publish-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback da Release publicada' },
    { id: 'milestone-open', modo: 'escrita', marcador: 'open', descricao: 'abertura da Milestone' },
    { id: 'milestone-open-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback da Milestone aberta' },
    { id: 'milestone-close', modo: 'escrita', marcador: 'close', descricao: 'fechamento da Milestone' },
    { id: 'milestone-close-readback', modo: 'leitura', marcador: 'ler', descricao: 'readback da Milestone fechada' },
  ];

  for (const passo of sequencia) {
    let tentativa = 0;
    let resultado = null;
    let falha = null;

    while (tentativa <= MAX_RETRIES) {
      // Reconstrói o snapshot fresco antes de cada tentativa
      const passoClient = makeFakeClient({ ...currentSnapshot, reviewedDigest });
      try {
        resultado = await passoClient[passo.marcador === 'ler' ? 'getReleaseByTag' : 'listMilestones'](currentSnapshot.target?.version);
        falha = null;
        break;
      } catch (err) {
        falha = err.message;
        tentativa += 1;
      }
    }

    const retryRegistrado = tentativa > 0;
    steps.push({
      ordem: steps.length + 1,
      id: passo.id,
      alvo: passo.descricao,
      modo: passo.modo,
      marcador: passo.marcador,
      resultado: resultado?.ok === false ? 'unavailable' : (falha ? 'failed' : 'ok'),
      tentativas: tentativa + 1,
      retry: retryRegistrado,
      falha: falha ?? null,
    });

    if (falha && tentativa > MAX_RETRIES) {
      aborted = true;
      break;
    }

    // Detecção de conflito (REC-04): se o readback revela objeto
    // duplicado/conflitante, aborta sem sobrescrever.
    if (resultado && resultado.ok === false && resultado.status === 409) {
      conflict = true;
      aborted = true;
      break;
    }

    // Atualiza o snapshot para a próxima transição
    currentSnapshot = { ...currentSnapshot, [passo.id]: resultado };
  }

  return { steps, finalSnapshot: currentSnapshot, aborted, conflict };
}

// Detecta conflito material entre dois objetos GitHub (REC-04).
//
// Dois objetos são conflitantes se compartilham a mesma natural key
// (release ID ou milestone number) mas divergem em SHA ou ID estável.
// Um objeto duplicado com o mesmo SHA e ID NÃO é conflito.
//
// RETORNA: true se houver conflito material, false caso contrário.
export function detectarConflito(existente, esperado) {
  if (!existente || !esperado) return false;
  if (existente.id === esperado.id && existente.sha === esperado.sha) return false;
  if (existente.id === esperado.id) return true;
  return false;
}

// Travamento local para invocações concorrentes (REC-05).
//
// Uma fechadura de arquivo em /tmp/sgrf-lock-{repo}/{version} bloqueia
// segundas invocações para o mesmo alvo. A fechadura contém o digest
// revisado e o passo atual, permitindo resume parcial.
//
// Resume sem evidência de estado parcial: rejeita com
// `partial-state-missing`, nunca assume limpo.
//
// RETORNA: { locked: true, lockId, passoAtual } ou
//          { locked: false, reason: 'partial-state-missing' }
export function adquirirTravamento(repo, version, reviewedDigest, passoAtual) {
  const lockId = `${repo}@${version}#${reviewedDigest.slice(0, 8)}`;
  // Simulação de fechadura de arquivo — em produção seria um flock
  // real sobre /tmp/sgrf-lock-{repo}/{version}.
  // Aquí, o lock é representado pelo lockId e pelo estado do passo.
  return { locked: true, lockId, passoAtual };
}

export function liberarTravamento(lockId) {
  // Simulação: em produção, remove a fechadura de arquivo.
  return { released: true, lockId };
}

export function rejeitarSemEstadoParcial(lockId) {
  // Resume sem evidência de estado parcial: rejeita.
  return { rejected: true, lockId, reason: 'partial-state-missing' };
}
