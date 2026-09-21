<template>
  <div class="grid" style="max-width:440px;margin:4rem auto">
    <div class="card accent">
      <h1 style="margin:0">SGRD <span style="color:var(--amber-hover)">·</span> Login</h1>
      <p class="hint">Acesso institucional @utfpr.edu.br</p>
      <div class="alert error" v-if="err" role="alert">{{ err }}</div>
      <div class="field"><label>E-mail</label><input class="input" v-model="email" placeholder="voce@utfpr.edu.br" autocomplete="username" /></div>
      <div class="field"><label>Senha</label><input class="input" v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" /></div>
      <button class="btn" style="width:100%" @click="doLogin" :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
const email = ref(''); const password = ref(''); const err = ref(''); const loading = ref(false);
const auth = useAuth(); const router = useRouter();
async function doLogin() {
  err.value = ''; loading.value = true;
  try { await auth.login(email.value.trim().toLowerCase(), password.value); router.push('/'); }
  catch (e) { err.value = e.response?.data?.error || 'Falha no login'; }
  finally { loading.value = false; }
}
</script>
