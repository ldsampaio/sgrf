<template>
  <div class="page" style="max-width:440px;margin:4rem auto">
    <div class="card accent">
      <p class="eyebrow">Acesso institucional</p>
      <h1 style="margin:0">SGRD <span class="spark-text">·</span> Portal</h1>

      <div class="alert warn" v-if="expiredNotice" role="status">
        Sua sessão expirou. Voltando para o portal.
      </div>

      <p class="hint" role="status" v-if="loading">Redirecionando…</p>

      <!-- Sem `login_url` o guard de redirect não monta o destino (open redirect):
           a página fica aqui e mostra o link, em vez de apontar para um host
           qualquer. -->
      <div class="alert error" v-if="err" role="alert">
        {{ err }}
        <a v-if="loginUrl" :href="loginUrl">Ir para o portal</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '../components/Icon.vue';
import { useAuth } from '../stores/auth';

// O sgrf não autentica credencial — não há formulário de login aqui. Esta página é
// só o ponto de redirecionamento para o saga, dono da credencial e da sessão
// compartilhada (`saga_session`). O endereço vem do `login_url` do 401, que
// plugins/auth.js executa; a página só aparece quando não há destino.
const auth = useAuth();
const router = useRouter();

const loading = ref(true);
const err = ref('');
const expiredNotice = ref(false);
const loginUrl = computed(() => (auth.acao?.tipo === 'redirect' ? auth.acao.url : null));

// Open-redirect protection: só caminho interno, um slash inicial, sem scheme/host.
function isInternalPath(p) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)
  );
}

async function resolve() {
  err.value = '';
  loading.value = true;
  const user = await auth.me();
  if (user) {
    const raw = new URLSearchParams(window.location.search).get('redirect') || '';
    router.push(isInternalPath(raw) ? raw : '/');
    loading.value = false;
    return;
  }
  // 401 com login_url: plugins/auth.js já redireciona. 503: página própria.
  // Aqui só fica o estado visual, sem destino.
  if (!loginUrl.value) err.value = 'Não foi possível confirmar sua identidade. Acesso negado.';
  loading.value = false;
}

onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    expiredNotice.value = params.get('reason') === 'session-expired';
  } catch { /* location/history unavailable → sem aviso */ }
  resolve();
});
</script>
