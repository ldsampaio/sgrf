<template>
  <p class="eyebrow">Exportação · prestação de contas</p>
  <h1 style="margin-top:0">Relatórios</h1>
  <div class="card accent">
    <div class="field"><label>Tipo</label>
      <select class="input" v-model="kind"><option value="requests">Solicitações</option><option value="financial">Financeiro</option><option value="voting">Votação</option><option value="accountability">Prestação de contas</option></select>
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn" @click="load(false)">Carregar</button>
      <button class="btn ghost" @click="load(true)">Exportar CSV</button>
      <a v-if="kind==='requests'||kind==='accountability'" :href="pdfUrl" target="_blank"><button class="btn dark">Exportar PDF</button></a>
    </div>
    <pre v-if="data" style="background:var(--deep);color:var(--online);border:1px solid var(--graphite);padding:1rem;border-radius:16px;overflow:auto">{{ JSON.stringify(data, null, 1).slice(0, 3000) }}</pre>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import { api } from '../services/api';
const kind = ref('requests'); const data = ref(null);
const pdfUrl = computed(() => `/api/reports/${kind.value}?format=pdf`);
async function load(csv) {
  const { data: d } = await api.get(`/reports/${kind.value}${csv ? '?format=csv' : ''}`);
  data.value = d;
}
</script>
