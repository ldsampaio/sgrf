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
import { ref, onMounted, watch } from 'vue';
import { api } from '../services/api';
import MoneyInput from '../components/MoneyInput.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { formatBRL } from '../utils/masks';
const list = ref([]); const loading = ref(false); const err = ref('');
const form = ref({ type: 'EQUIPAMENTO', title: '', justification: '', spec: '' });
const valueCents = ref(0);
const DRAFT_KEY = 'sgrf:pending-draft';
// Suppress flag: programmatic resets (restore on mount, clear on submit)
// must not re-persist through the watcher — only genuine user input writes.
let suppressPersist = false;
// Proactive form-side persist (D-09…D-10): every input/change overwrites the
// single-slot snapshot, so a forced-logout bounce always finds the latest
// draft. The interceptor only bounces — no cross-module hook. Every storage
// access is try/catch (D-12: same-origin per-tab storage, no encryption).
function persistDraft() {
  if (suppressPersist) return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      type: form.value.type,
      title: form.value.title,
      justification: form.value.justification,
      spec: form.value.spec,
      valueCents: valueCents.value,
    }));
  } catch { /* storage unavailable → best-effort, ignore */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
}
watch([() => form.value.type, () => form.value.title, () => form.value.justification, () => form.value.spec, valueCents], persistDraft, { flush: 'sync' });
// Best-effort draft restore (D-09…D-11): after a forced-logout bounce the
// Requests form reopens with its pre-bounce snapshot. The slot is cleared
// unconditionally on mount so orphan snapshots never linger; malformed content
// opens an empty form and never blocks navigation.
function restoreDraft() {
  suppressPersist = true;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && typeof d.title === 'string') {
      const TYPES = ['EQUIPAMENTO', 'PUBLICACAO', 'VIAGEM', 'AUXILIO_ESTUDANTIL'];
      form.value.type = TYPES.includes(d.type) ? d.type : form.value.type;
      form.value.title = d.title ?? '';
      form.value.justification = typeof d.justification === 'string' ? d.justification : '';
      form.value.spec = typeof d.spec === 'string' ? d.spec : '';
      valueCents.value = Number.isFinite(d.valueCents) ? d.valueCents : 0;
    }
  } catch { /* corrupt slot → open empty (D-11) */ }
  finally { clearDraft(); suppressPersist = false; }
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
    suppressPersist = true;
    form.value.title = ''; valueCents.value = 0;
    clearDraft();
    suppressPersist = false;
    await load();
  } catch (e) { err.value = e.response?.data?.error || 'Falha'; } finally { loading.value = false; }
}
async function submit(id) { await api.post(`/requests/${id}/submit`); await load(); }
onMounted(() => { restoreDraft(); load(); });
</script>
