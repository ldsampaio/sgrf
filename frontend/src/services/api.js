import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

// Single-flight session refresh (SES-01): one in-flight POST /auth/refresh per
// tab. Concurrent 401s await the same promise instead of firing N refreshes.
// NOTE: this module must never import the router or the auth store — that
// would create an api ⇄ router ⇄ store ⇄ api import cycle. Session death
// navigates via window.location.assign (full reload, clears Pinia state).
let refreshPromise = null;

// Redirect-once flag, set BEFORE window.location.assign() so N concurrent
// rejected retries issue exactly one navigation.
let isRedirecting = false;

function doBounce() {
  if (isRedirecting) return;
  // Already on the login page (including the ?reason=... landing itself):
  // never bounce. window.location.assign() is a full reload that resets this
  // module flag, so bouncing from /login re-triggers itself forever: the
  // router beforeEach calls auth.me() on every navigation, me() 401s, refresh
  // fails, doBounce() fires again. The router already keeps unauthenticated
  // users on /login — there is nowhere to bounce to.
  if (window.location.pathname === '/login') return;
  isRedirecting = true;
  const origin = window.location.pathname + window.location.search;
  const safeOrigin = origin.startsWith('/login') ? '/' : origin;
  window.location.assign('/login?reason=session-expired&redirect=' + encodeURIComponent(safeOrigin));
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    // 401-only gate: 403 (incl. PASSWORD_CHANGE_REQUIRED for Phase 8 SES-02),
    // 429, 5xx, network errors and timeouts reject through untouched.
    if (response?.status !== 401 || !config || config._retry) throw error;
    // The refresh call itself never re-enters the refresh path.
    // Bypass auth endpoints that legitimately 401 outside a session (login, not just refresh)
    if (typeof config.url === 'string' && /\/auth\/(login|refresh|register|logout)/.test(config.url)) throw error;
    config._retry = true;
    try {
      refreshPromise ??= api.post('/auth/refresh').finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      // Replay the original request once with its original config
      // (withCredentials preserved). A replayed 401 rejects straight through
      // via the _retry guard above — never re-enters refresh.
      return api(config);
    } catch {
      // Refresh death only (dead 7-day cookie): bounce exactly once.
      doBounce();
      throw error;
    }
  },
);
