// Decisão de caminho para erro de sessão — 401 e 503 NÃO são o mesmo caminho.
//
//   401 → redireciona para o saga usando o `login_url` do corpo da resposta.
//   503 → renderiza a página de erro própria. Não redireciona: redirecionar para
//         o serviço que caiu é o loop que se quer evitar.
//
// Módulo puro (sem Vue, sem router) para poder ser exercitado pelos testes.
export function decidirAcao(status, corpo) {
  if (status === 503) {
    return {
      tipo: 'pagina',
      rota: 'unavailable',
      code: corpo?.code || 'IDENTITY_UNAVAILABLE',
      retryAfter: corpo?.retry_after ?? null,
    };
  }

  if (status === 401) {
    return { tipo: 'redirect', url: corpo?.login_url || null };
  }

  return { tipo: 'nada' };
}
