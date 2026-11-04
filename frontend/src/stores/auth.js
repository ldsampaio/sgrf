import { defineStore } from 'pinia';
import { api } from '../services/api';
import { decidirAcao } from '../plugins/decisaoErro.js';

// Estado de sessão em memória, nunca em localStorage: a fonte da verdade é o Redis
// do saga. Sem sessão o próximo request 401 e o guard manda o usuário para o saga.
export const useAuth = defineStore('auth', {
  state: () => ({ user: null, acao: null }),
  actions: {
    async me() {
      try {
        const { data } = await api.get('/auth/me');
        this.user = data.user;
        this.acao = null;
        return this.user;
      } catch (e) {
        this.user = null;
        // O 401 do contrato traz `login_url` — é a única fonte do endereço do saga
        // que o frontend usa. O 503 não traz login_url de propósito.
        this.acao = decidirAcao(e.response?.status, e.response?.data);
        return null;
      }
    },

    limpar() {
      this.user = null;
    },

    // O logout é do saga (ele derruba a sessão no Redis e remove o cookie
    // compartilhado `saga_session`). O sgrf não tem rota de logout: limpa o estado
    // local e vai para a página de redirecionamento, que usa o `login_url` do 401.
    redirectToSaga() {
      this.limpar();
      const url = this.acao?.tipo === 'redirect' ? this.acao.url : null;
      if (url) window.location.assign(url);
    },
  },
});
