<template>
  <h1 style="margin-top:0">Admin</h1>
  <div class="card accent">
    <h2 style="margin-top:0">Importar lote (JSON, só admin)</h2>
    <p class="hint">Arquivo <code>.json</code>: <code>[{"name":"...","email":"...@utfpr.edu.br","role":"PROFESSOR"}]</code></p>
    <input type="file" accept=".json,application/json" @change="pick" />
    <div style="margin-top:.6rem;display:flex;gap:.5rem">
      <button class="btn ghost" @click="preview" :disabled="!file">Pré-visualizar</button>
      <button class="btn" @click="confirm" :disabled="!file">Confirmar importação</button>
    </div>
    <div class="alert error" v-if="err" role="alert">{{ err }}</div>
    <div v-if="result">
      <h3>Resumo: {{ JSON.stringify(result.summary) }}</h3>
      <table class="table"><thead><tr><th>E-mail</th><th>Info/erro</th></tr></thead><tbody>
        <tr v-for="v in result.valid || result.created || []" :key="v.email"><td>{{ v.email }}</td><td>{{ v.role || 'criado' }}</td></tr>
        <tr v-for="e in result.invalid || result.errors || []" :key="e.email + e.index"><td>{{ e.email }}</td><td>{{ e.error }}</td></tr>
      </tbody></table>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { api } from '../services/api';
const file = ref(null); const result = ref(null); const err = ref('');
function pick(e) { file.value = e.target.files[0]; result.value = null; err.value = ''; }
async function send(path) {
  err.value = '';
  const fd = new FormData();
  fd.append('file', file.value);
  try {
    const { data } = await api.post(path, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    result.value = data;
  } catch (e) { err.value = e.response?.data?.error || 'Falha'; }
}
const preview = () => send('/users/batch/preview');
const confirm = () => { if (window.confirm('Confirmar criação em lote?')) send('/users/batch/confirm'); };
</script>
