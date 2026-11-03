<template>
  <div class="auth">
    <section class="auth__art" aria-label="Sobre o SGRD">
      <router-link to="/login" class="brand" aria-label="SGRD UTFPR">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
            <path d="M4.5 5 10 12l-5.5 7" />
            <path d="M12.5 5 18 12l-5.5 7" />
          </svg>
        </span>
        <span class="brand__text">
          <span class="brand__name">SGRD</span>
          <span class="brand__sub">UTFPR</span>
        </span>
      </router-link>

      <div class="auth__art-content">
        <p class="eyebrow">Gestão departamental</p>
        <h1>Recursos com <span class="accent">rastreabilidade</span> do pedido ao gasto.</h1>
        <p>Solicitações, aprovação automática, votação auditável e prestação de contas em um só lugar.</p>
        <ul class="auth__features">
          <li class="auth__feature">
            <Icon name="shield" :size="18" />
            <span><b>Votação auditável</b> — cada voto registra autor, papel e horário de Brasília.</span>
          </li>
          <li class="auth__feature">
            <Icon name="wallet" :size="18" />
            <span><b>Saldo sob controle</b> — disponível, provisionado e gasto sempre visíveis.</span>
          </li>
          <li class="auth__feature">
            <Icon name="receipt" :size="18" />
            <span><b>Prestação de contas</b> — relatórios em CSV e PDF para cada etapa do fluxo.</span>
          </li>
        </ul>
      </div>

      <p class="auth__art-foot">Uso institucional · apenas e-mails @utfpr.edu.br · horário de Brasília</p>
    </section>

    <section class="auth__panel">
      <div class="auth__card">
        <p class="eyebrow">Acesso institucional</p>
        <h2>Entrar no SGRD</h2>
        <p class="auth__intro">Use seu e-mail institucional e a senha cadastrada.</p>

        <div v-if="expiredNotice" class="alert alert--warning" role="status" style="margin-bottom: var(--space-4)">
          <Icon class="alert__icon" name="clock" :size="18" />
          <div class="alert__body">Sua sessão expirou. Entre novamente para continuar.</div>
        </div>

        <div v-if="err" class="alert alert--error" role="alert" style="margin-bottom: var(--space-4)">
          <Icon class="alert__icon" name="alert-circle" :size="18" />
          <div class="alert__body">{{ err }}</div>
        </div>

        <form class="stack" @submit.prevent="doLogin">
          <div class="field">
            <label class="field__label" for="login-email">E-mail institucional</label>
            <input
              id="login-email"
              v-model="email"
              class="input"
              type="email"
              placeholder="voce@utfpr.edu.br"
              autocomplete="username"
              inputmode="email"
              required
              autofocus
            />
          </div>

          <div class="field">
            <label class="field__label" for="login-password">Senha</label>
            <div class="input-wrap input-wrap--suffix">
              <input
                id="login-password"
                v-model="password"
                class="input"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="input-wrap__suffix"
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <Icon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn--block btn--lg" :disabled="loading" style="margin-top: var(--space-2)">
            <span v-if="loading" class="spinner" aria-hidden="true"></span>
            {{ loading ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>

        <p class="auth__foot">Problemas para acessar? Procure a administração do departamento.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '../components/Icon.vue';
import { useAuth } from '../stores/auth';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const err = ref('');
const loading = ref(false);
const auth = useAuth();
const router = useRouter();

// Session-expiry bounce context (D-02): the interceptor lands here with
// ?reason=session-expired&redirect=<origin>. Plain /login visits carry no
// params and keep the default post-login push('/') (D-03).
const expiredNotice = ref(false);
const redirectTarget = ref('');

// Open-redirect protection (D-04): internal-path-only — single leading slash,
// reject double-slash prefix, reject scheme/host patterns. Anything else is
// discarded and falls back to '/'.
function isInternalPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)
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
  err.value = '';
  if (!email.value.trim() || !password.value) {
    err.value = 'Informe e-mail e senha para continuar.';
    return;
  }
  loading.value = true;
  try {
    await auth.login(email.value.trim().toLowerCase(), password.value);
    router.push(redirectTarget.value || '/');
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha no login. Verifique seus dados e tente novamente.';
  } finally {
    loading.value = false;
  }
}
</script>
