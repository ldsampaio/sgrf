<template>
  <h1 style="margin-top:0">Solicitações</h1>
  <p class="eyebrow">Rascunho · submissão · acompanhamento</p>
  <div class="card accent">
    <h2 style="margin-top:0">Nova solicitação (rascunho)</h2>
    <div class="alert error" v-if="err" role="alert">{{ err }}</div>
    <form @submit.prevent="create">
      <div class="field"><label>Tipo</label>
        <select class="input" v-model="form.type"><option>EQUIPAMENTO</option><option>PUBLICACAO</option><option>VIAGEM</option><option>AUXILIO_ESTUDANTIL</option></select>
      </div>
      <div class="field"><label>Título</label><input class="input" v-model="form.title" required /></div>
      <div class="field"><label>Justificativa</label><textarea class="input" v-model="form.justification" rows="2" /></div>
      <MoneyInput v-model="valueCents" label="Valor estimado (R$)" hint="Máscara BRL automática, modelo em centavos" />
      <div class="field"><label>Especificação (equipamento)</label><input class="input" v-model="form.spec" /></div>
      <p>Total estimado: <b>{{ formatBRL(valueCents) }}</b></p>
      <button class="btn" :disabled="loading">{{ loading ? 'Salvando…' : 'Criar rascunho' }}</button>
    </form>
  </div>
  <div class="card" style="margin-top:1rem">
    <table class="table"><thead><tr><th>Título</th><th>Status</th><th>Valor</th><th></th></tr></thead>
    <tbody><tr v-for="r in list" :key="r.id">
      <td>{{ r.title }}</td><td><StatusBadge :status="r.status" /></td><td>{{ formatBRL(r.requestedAmountCents) }}</td>
      <td><button v-if="r.status === 'RASCUNHO'" class="btn ghost" @click="submit(r.id)">Submeter</button></td>
    </tr></tbody></table>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../services/api';
import MoneyInput from '../components/MoneyInput.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { formatBRL } from '../utils/masks';
const list = ref([]); const loading = ref(false); const err = ref('');
const form = ref({ type: 'EQUIPAMENTO', title: '', justification: '', spec: '' });
const valueCents = ref(0);
// Best-effort draft restore (D-09…D-11): after a forced-logout bounce the
// Requests form reopens with its pre-bounce snapshot. The slot is cleared
// unconditionally on mount so orphan snapshots never linger; malformed content
// opens an empty form and never blocks navigation.
function restoreDraft() {
  try {
    const raw = sessionStorage.getItem('sgrf:pending-draft');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && typeof d.title === 'string') {
      form.value.type = typeof d.type === 'string' ? d.type : form.value.type;
      form.value.title = d.title ?? '';
      form.value.justification = typeof d.justification === 'string' ? d.justification : '';
      form.value.spec = typeof d.spec === 'string' ? d.spec : '';
      valueCents.value = Number.isFinite(d.valueCents) ? d.valueCents : 0;
    }
  } catch { /* corrupt slot → open empty (D-11) */ }
  finally {
    try { sessionStorage.removeItem('sgrf:pending-draft'); } catch { /* best-effort */ }
  }
}
async function load() { const { data } = await api.get('/requests'); list.value = data.requests; }
async function create() {
  loading.value = true; err.value = '';
  try {
    const v = valueCents.value / 100;
    await api.post('/requests', {
      type: form.value.type, title: form.value.title, justification: form.value.justification,
      payload: { estimatedValue: v, publicationFee: v, estimatedAmount: v, technicalSpecification: form.value.spec || 'n/a', dailyCount: 1, dailyRate: v, passageAmount: 0, currency: 'BRL' },
    });
    form.value.title = ''; valueCents.value = 0;
    await load();
  } catch (e) { err.value = e.response?.data?.error || 'Falha'; } finally { loading.value = false; }
}
async function submit(id) { await api.post(`/requests/${id}/submit`); await load(); }
onMounted(() => { restoreDraft(); load(); });
</script>
