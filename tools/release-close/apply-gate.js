// Portão de dupla trava do apply (SAFE-04, decisão D-14).
//
// O apply só avança com as TRÊS fechaduras presentes ao mesmo tempo:
//   1. flag    — `--yes` informada explicitamente na linha de comando;
//   2. tty     — processo.stdin.isTTY verdadeiro (terminal humano vivo);
//   3. answer  — o operador digita `sim` no prompt, depois de ler o plano.
//
// Nenhuma fechadura isolada aprova o apply: um `--yes` deixado num script ou
// num cron não confirma nada, e um pipe não substitui a digitação. A ordem de
// verificação é flag -> tty -> answer, fixa e testada; a recusa é sempre
// fail-closed, com motivo em PT-BR e nome da fechadura que faltou.
//
// O plano ordenado é gravado por este módulo ANTES de qualquer prompt: o gate
// recebe o texto já renderizado pelo CLI e o entrega ao `write` injetado, de
// modo que "plano visível antes de perguntar" é invariante executável (a
// suíte SAFE-04 grava o sink e prova que a pergunta só veio depois).
//
// `confirmApply` é uma função pura em relação ao resto do processo: não
// guarda estado entre chamadas, não lê ambiente e não escreve nada além do
// `write` injetado — duas avaliações seguidas partem do mesmo estado.

export const CONFIRMATION_WORD = 'sim';

// Ordem fixa das fechaduras. `plan` não é uma fechadura de D-14: é a
// pré-condição de visibilidade, verificada antes porque um apply sem plano
// humano violaria a proibição da fase.
export const APPLY_LOCKS = ['plan', 'flag', 'tty', 'prompt', 'answer'];

function refusal(lock, reason) {
  return { confirmed: false, lock, reason };
}

export async function confirmApply(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Entrada inválida: esperado um objeto com yesFlag, isTTY, planText e ask.');
  }
  const { yesFlag, isTTY, planText, ask } = input;
  const write = input.write === undefined ? () => {} : input.write;
  if (typeof write !== 'function') {
    throw new TypeError('Entrada inválida: write precisa ser uma função de saída.');
  }

  // Pré-condição de visibilidade: sem plano renderizado não há pergunta.
  if (typeof planText !== 'string' || planText.trim().length === 0) {
    return refusal('plan', 'Apply recusa: nenhum plano foi renderizado para revisão humana prévia.');
  }

  // Plano sempre visível antes de qualquer pergunta (D-15).
  write(planText);

  // Fechadura 1: a flag explícita.
  if (yesFlag !== true) {
    return refusal(
      'flag',
      'Apply recusa: a flag --yes não foi informada; nenhuma escrita foi tentada.',
    );
  }

  // Fechadura 2: terminal humano vivo, mesmo com a flag presente.
  if (isTTY !== true) {
    return refusal(
      'tty',
      'Apply recusa: é obrigatório um terminal interativo; entrada redirecionada ou pipe não confirma nada, mesmo com --yes.',
    );
  }

  // Fechadura 3: digitação do operador depois do plano visível.
  if (typeof ask !== 'function') {
    return refusal('prompt', 'Apply recusa: a confirmação digitada não pôde ser lida.');
  }
  const answer = await ask();
  const normalized = typeof answer === 'string' ? answer.trim().toLowerCase() : '';
  if (normalized !== CONFIRMATION_WORD) {
    return refusal(
      'answer',
      `Apply cancelado pelo operador: a confirmação digitada não foi "${CONFIRMATION_WORD}".`,
    );
  }

  return {
    confirmed: true,
    lock: null,
    reason: `Confirmação dupla aceita: --yes, terminal interativo e digitação "${CONFIRMATION_WORD}" após o plano.`,
  };
}
