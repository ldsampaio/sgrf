// Executor do caminho de sessão. Único ponto de navegação para 401/503: o guard do
// router e as chamadas em voo passam por aqui, então dois failures concorrentes
// produzem exatamente uma navegação.
//
//   401 → redirect para o saga com o `login_url` do corpo.
//   503 → página de erro própria, SEM redirect (redirecionar para o serviço que
//         caiu é o loop que se quer evitar).
import router from '../router/index.js';
import { useAuth } from '../stores/auth.js';
import { decidirAcao } from './decisaoErro.js';

let executando = false;

export async function executaAcao(acao) {
  if (!acao || acao.tipo === 'nada' || executando) return null;
  executando = true;

  const auth = useAuth();
  auth.limpar();

  try {
    if (acao.tipo === 'redirect') {
      if (acao.url) {
        // Reload completo: derruba o estado Pinia e o histórico de navegação.
        window.location.assign(acao.url);
        return null;
      }
      // Sem login_url (host de origem fora da allowlist) — a página de
      // redirecionamento resolve sozinha quando o saga responde.
      return await router.push({ name: 'login' });
    }

    // 503: página de erro própria, SEM redirect.
    return await router.push({
      name: acao.rota,
      query: acao.retryAfter ? { retry_after: String(acao.retryAfter) } : {},
    });
  } finally {
    // O flag só importa enquanto a página vive; o redirect faz reload completo,
    // que recarrega o módulo. Para router.push, liberar permite a próxima decisão.
    executando = false;
  }
}

window.addEventListener('sgrf:auth', (event) => {
  executaAcao(decidirAcao(event.detail?.status, event.detail?.body));
});
