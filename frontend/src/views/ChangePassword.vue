<template>
  <p class="eyebrow">Segurança</p>
  <h1 style="margin-top: 0">Troca obrigatória de senha</h1>
  <div class="card" style="max-width: 440px">
    <p class="hint">Sua senha temporária expirou ou precisa ser trocada. Defina uma nova senha para continuar.</p>
    <div class="field">
      <label>Senha temporária / atual</label>
      <input class="input" type="password" v-model="currentPassword" placeholder="Senha atual" />
    </div>
    <div class="field">
      <label>Nova senha</label>
      <input class="input" type="password" v-model="newPassword" placeholder="Nova senha (8+ caracteres)" />
    </div>
    <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
      <button class="btn dark" :disabled="loading" @click="submit">{{ loading ? 'Trocando…' : 'Trocar senha' }}</button>
      <button class="btn ghost" @click="logout">Sair</button>
    </div>
    <div class="alert error" v-if="err" role="alert" style="margin-top: 1rem">{{ err }}</div>
    <div class="alert ok" v-if="ok" role="alert" style="margin-top: 1rem">Senha trocada com sucesso — redirecionando…</div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';

const router = useRouter();
const auth = useAuth();
const currentPassword = ref('');
const newPassword = ref('');
const loading = ref(false);
const err = ref('');
const ok = ref(false);

async function submit() {
  err.value = '';
  loading.value = true;
  try {
    await api.post('/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    ok.value = true;
    await auth.me();
    setTimeout(() => router.push('/'), 600);
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha na troca';
  } finally {
    loading.value = false;
  }
}

async function logout() {
  await api.post('/auth/logout');
  auth.user = null;
  router.push('/login');
}
</script>
