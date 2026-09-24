<template>
  <div class="grid" style="max-width:440px;margin:4rem auto">
    <div class="card accent">
      <p class="eyebrow">Acesso institucional</p>
      <h1 style="margin:0">SGRD <span class="spark-text">·</span> Login</h1>
      <p class="hint">Acesso institucional @utfpr.edu.br</p>
      <div class="alert warn" v-if="expiredNotice" role="status">Sua sessão expirou. Entre novamente para continuar.</div>
      <div class="alert error" v-if="err" role="alert">{{ err }}</div>
      <div class="field"><label>E-mail</label><input class="input" v-model="email" placeholder="voce@utfpr.edu.br" autocomplete="username" /></div>
      <div class="field"><label>Senha</label><input class="input" v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" /></div>
      <button class="btn" style="width:100%" @click="doLogin" :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
const email = ref(''); const password = ref(''); const err = ref(''); const loading = ref(false);
const auth = useAuth(); const router = useRouter();
// Session-expiry bounce context (D-02): the interceptor lands here with
// ?reason=session-expired&redirect=<origin>. Plain /login visits carry no
// params and keep the default post-login push('/') (D-03).
const expiredNotice = ref(false);
const redirectTarget = ref('');
// Open-redirect protection (D-04): internal-path-only — single leading slash,
// reject double-slash prefix, reject scheme/host patterns. Anything else is
// discarded and falls back to '/'.
function isInternalPath(p) {
  return (
    typeof p === 'string' &&
    p.startsWith('/') &&
    !p.startsWith('//') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p)
  );
}
onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    expiredNotice.value = params.get('reason') === 'session-expired';
    const raw = params.get('redirect') || '';
    redirectTarget.value = isInternalPath(raw) ? raw : '';
    // Clean the consumed query params (D-05): the URL is clean afterwards, so
    // a later refresh on login hides the notice. The redirect survives in the
    // ref, and the notice persists while the user types until login succeeds
    // (D-06) — nothing here clears expiredNotice except unmount.
    if (params.has('reason') || params.has('redirect')) {
      history.replaceState(null, '', window.location.pathname);
    }
  } catch { /* location/history unavailable → plain login, no notice */ }
});
async function doLogin() {
  err.value = ''; loading.value = true;
  try {
    await auth.login(email.value.trim().toLowerCase(), password.value);
    router.push(redirectTarget.value || '/');
  }
  catch (e) { err.value = e.response?.data?.error || 'Falha no login'; }
  finally { loading.value = false; }
}
</script>
