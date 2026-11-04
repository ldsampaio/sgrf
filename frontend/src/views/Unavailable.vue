<template>
  <div class="page" style="max-width:440px;margin:4rem auto">
    <div class="card">
      <p class="eyebrow">Identidade indisponível</p>
      <h1 style="margin:0">Acesso negado</h1>

      <p class="hint" role="status">
        Não foi possível confirmar sua identidade. Acesso negado. O serviço de autenticação
        não está respondendo.
      </p>

      <p class="hint" v-if="retryAfter">Tentar novamente em {{ retryAfter }} segundos.</p>

      <button class="btn" style="width:100%" :disabled="carregando" @click="tentarDeNovo">
        {{ carregando ? 'Confirmando…' : 'Tentar de novo' }}
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';

// Página de erro própria do sgrf (contrato §4.1): renderizada pelo sgrf porque o
// saga é justamente o que caiu. Não revela claims do token, `sid` nem estado
// interno — só a copy comum e o Retry-After.
const route = useRoute();
const router = useRouter();
const auth = useAuth();

const carregando = ref(false);
const retryAfter = computed(() => route.query.retry_after || null);

async function tentarDeNovo() {
  carregando.value = true;
  try {
    const user = await auth.me();
    if (user) router.push('/');
  } finally {
    carregando.value = false;
  }
}
</script>
