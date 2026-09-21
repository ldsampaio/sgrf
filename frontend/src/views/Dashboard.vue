<template>
  <h1 style="margin-top:0">Dashboard</h1>
  <div class="card accent">
    <div class="field" style="max-width:200px"><label>Ano</label>
      <select class="input" v-model="year" @change="load"><option v-for="y in years" :key="y" :value="y">{{ y }}</option></select>
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn dark" @click="exportPDF" :disabled="!ready || exporting">{{ exporting ? 'Gerando…' : 'Exportar PDF com gráficos' }}</button>
    </div>
    <p class="hint" v-if="err" style="color:red">{{ err }}</p>
  </div>
  <div class="grid cols-3" v-if="bal" style="margin-top:1rem">
    <div class="card accent"><div class="kpi-label">Disponível</div><div class="kpi">{{ brl(bal.availableCents) }}</div></div>
    <div class="card"><div class="kpi-label">Provisionado</div><div class="kpi">{{ brl(bal.provisionedCents) }}</div></div>
    <div class="card"><div class="kpi-label">Gasto</div><div class="kpi">{{ brl(bal.spentCents) }}</div></div>
  </div>
  <div class="alert error" v-if="errBal" role="alert">{{ errBal }}</div>
  <div class="alert error" v-if="errDash" role="alert">{{ errDash }}</div>
  <div class="grid cols-3" style="margin-top:1rem" v-if="dash">
    <div class="card accent"><h3>Docentes × valores solicitados</h3><PieChart ref="c1" :labels="dash.byDocente.map(d=>d.name)" :values="dash.byDocente.map(d=>d.totalCents)" /></div>
    <div class="card"><h3>Disponível × Provisionado × Gasto</h3><PieChart ref="c2" :labels="['Disponível','Provisionado','Gasto']" :values="[dash.bySaldo.disponivel,dash.bySaldo.provisionado,dash.bySaldo.gasto]" /></div>
    <div class="card"><h3>Gastos por categoria</h3><PieChart ref="c3" :labels="dash.byCategoria.map(c=>c.type)" :values="dash.byCategoria.map(c=>c.totalCents)" /></div>
  </div>
  <div class="card" style="margin-top:1rem">
    <h2 style="margin-top:0">Minhas solicitações</h2>
    <div class="alert error" v-if="errReqs" role="alert">{{ errReqs }}</div>
    <table class="table"><thead><tr><th>Título</th><th>Status</th><th>Valor</th></tr></thead>
    <tbody><tr v-for="r in reqs" :key="r.id"><td>{{ r.title }}</td><td><StatusBadge :status="r.status" /></td><td>{{ brl(r.requestedAmountCents) }}</td></tr></tbody></table>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge.vue';
import PieChart from '../components/PieChart.vue';
const y0 = new Date().getFullYear();
const years = [y0 - 1, y0, y0 + 1];
const year = ref(y0);
const bal = ref(null); const reqs = ref([]); const dash = ref(null);
const c1 = ref(null); const c2 = ref(null); const c3 = ref(null);
const ready = ref(true); const exporting = ref(false); const err = ref('');
const errBal = ref(''); const errReqs = ref(''); const errDash = ref('');
const brl = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
async function load() {
  errBal.value = ''; errReqs.value = ''; errDash.value = '';
  try {
    const { data } = await api.get('/settings'); bal.value = data.balance;
  } catch (e) { errBal.value = e.response?.data?.error || 'Falha ao carregar saldos'; }
  try {
    const r = await api.get('/requests?mine=1'); reqs.value = r.data.requests;
  } catch (e) { errReqs.value = e.response?.data?.error || 'Falha ao carregar solicitações'; }
  try {
    dash.value = (await api.get(`/reports/dashboard?year=${year.value}`)).data;
  } catch (e) { errDash.value = e.response?.data?.error || 'Falha ao carregar gráficos'; }
}
async function exportPDF() {
  err.value = ''; exporting.value = true;
  try {
    const images = {
      docentes: c1.value?.toImage() || null,
      saldos: c2.value?.toImage() || null,
      categorias: c3.value?.toImage() || null,
    };
    const { data } = await api.post('/reports/dashboard-pdf', { year: year.value, images }, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  } catch (e) { err.value = e.response?.data?.error || 'Falha ao gerar PDF'; } finally { exporting.value = false; }
}
onMounted(load);
</script>
