// Costura de reconciliação — PLACEHOLDER do ciclo RED do plano 09-09.
//
// Este arquivo existe no commit `test(09-09)` apenas para que a suíte
// `failure.test.js` CARREGUE e cada prova falhe sobre uma ASSERÇÃO sobre o
// comportamento planejado, em vez de sobre um erro de resolução de módulo.
// Sem este lugar reservado, todas as sondas da tarefa 1 abortariam no
// `import` — uma falha de carga, que o verificador de evidência RED classifica
// como inválida exatamente porque nada chegou a ser verificado.
//
// O placeholder NÃO implementa nada: devolve sempre as três decisões nulas e
// nenhuma leitura, o que faz toda prova de comportamento falhar. O commit
// `feat(09-09)` o substitui inteiro pela costura real.

export async function reconciliar() {
  return {
    evidence: null,
    eligibility: null,
    classification: null,
    reads: [],
    mutations: 0,
    family: null,
    reason: null,
    recovered: false,
    writeAction: null,
    writeProposed: false,
  };
}
