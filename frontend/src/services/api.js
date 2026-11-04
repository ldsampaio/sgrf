import axios from 'axios';

// A sessão é o cookie compartilhado `saga_session`, definido pelo saga: não há
// token em localStorage, não há refresh e não há login aqui — o sgrf não autentica
// credencial, ele confirma no Redis que a sessão do saga está viva
// (docs/session-contract.md).
export const api = axios.create({ baseURL: '/api', withCredentials: true });

// 401 e 503 são caminhos distintos (401 → redirect para o saga; 503 → página de
// erro própria). O interceptor apenas informa; quem executa a ação é
// plugins/auth.js, o único ponto de navegação — assim o guard do router e as
// chamadas em voo não competem por dois redirects.
// NOTE: este módulo não importa o router nem a store — isso criaria o ciclo
// api ⇄ router ⇄ store ⇄ api.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 503) {
      window.dispatchEvent(new CustomEvent('sgrf:auth', {
        detail: { status, body: error.response?.data || null },
      }));
    }
    return Promise.reject(error);
  },
);
