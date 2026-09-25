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
      <td>
        <button v-if="r.status === 'RASCUNHO'" class="btn ghost" @click="submit(r.id)">Submeter</button>
        <!-- VOT-03: Arbitration panel for chefe -->
        <div v-else-if="isArbitrationState(r) && isChefe" class="arbitration-panel">
          <div class="alert warning" role="alert">
            <strong>Arbitragem necessária — voto parcial detectado</strong>
          </div>
          <div class="field">
            <label>Valor aprovado final (R$)</label>
            <MoneyInput v-model="arbitrationAmounts[r.id]" :max="r.requestedAmountCents" :min="1" required />
            <small class="hint">Entre 1 e {{ formatBRL(r.requestedAmountCents) }}</small>
          </div>
          <div class="field">
            <label>Justificativa da arbitragem <span class="required">*</span></label>
            <textarea class="input" v-model="arbitrationJustifications[r.id]" rows="3" placeholder="Justificativa obrigatória para arbitragem" required />
          </div>
          <button class="btn" :disabled="arbitrationLoading[r.id]" @click="confirmArbitration(r.id)">
            {{ arbitrationLoading[r.id] ? 'Confirmando…' : 'Confirmar Arbitragem' }}
          </button>
          <div v-if="arbitrationError[r.id]" class="alert error" role="alert" style="margin-top:.5rem">{{ arbitrationError[r.id] }}</div>
        </div>
        <!-- VOT-04: Cancel button for non-terminal requests -->
        <button v-else-if="canCancel(r)" class="btn ghost" @click="openCancelModal(r)">Cancelar</button>
      </td>
    </tr></tbody></table>
  </div>

  <!-- VOT-04: Cancel confirmation modal -->
  <div v-if="cancelModal.request" class="modal-overlay" @click.self="closeCancelModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <h3 id="cancel-modal-title">Cancelar solicitação</h3>
      <p><strong>{{ cancelModal.request.title }}</strong></p>
      <p>Status atual: <StatusBadge :status="cancelModal.request.status" /></p>
      <div class="alert warning" role="alert" v-if="isApprovedStatus(cancelModal.request.status)">
        <strong>Atenção:</strong> Esta solicitação está aprovada/provisionada. O cancelamento exigirá reversão financeira e só pode ser feito por ADMINISTRADOR ou CHEFE_DEPARTAMENTO.
      </div>
      <div class="field">
        <label>Justificativa <span class="required">*</span></label>
        <textarea class="input" v-model="cancelJustification" rows="3" placeholder="Justificativa obrigatória" required @keyup.enter="confirmCancel" />
      </div>
      <div v-if="cancelError" class="alert error" role="alert">{{ cancelError }}</div>
      <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:1rem">
        <button class="btn ghost" @click="closeCancelModal" :disabled="cancelLoading">Voltar</button>
        <button class="btn" @click="confirmCancel" :disabled="cancelLoading || !cancelJustification.trim()">
          {{ cancelLoading ? 'Cancelando…' : 'Confirmar cancelamento' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useAuth } from '../stores/auth';
import { api } from '../services/api';
import MoneyInput from '../components/MoneyInput.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { formatBRL } from '../utils/masks';

const auth = useAuth();
const list = ref([]);
const loading = ref(false);
const err = ref('');
const form = ref({ type: 'EQUIPAMENTO', title: '', justification: '', spec: '' });
const valueCents = ref(0);
const DRAFT_KEY = 'sgrf:pending-draft';

// VOT-03: Arbitration state
const arbitrationAmounts = ref({});
const arbitrationJustifications = ref({});
const arbitrationLoading = ref({});
const arbitrationError = ref({});

// VOT-04: Cancel modal state
const cancelModal = ref({ request: null });
const cancelJustification = ref('');
const cancelLoading = ref(false);
const cancelError = ref('');

// Suppress flag: programmatic resets (restore on mount, clear on submit)
// must not re-persist through the watcher — only genuine user input writes.
let suppressPersist = false;

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

async function load() {
  const { data } = await api.get('/requests');
  list.value = data.requests;
}

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

async function submit(id) {
  await api.post(`/requests/${id}/submit`);
  await load();
}

// VOT-03: Check if request is in arbitration state (APROVADO_PARCIALMENTE + AGUARDANDO_ARBITRAGEM)
function isArbitrationState(request) {
  return request.status === 'APROVADO_PARCIALMENTE' && request.decisionReason === 'AGUARDANDO_ARBITRAGEM';
}

// Check if current user is chefe
function isChefe() {
  return auth.user?.role === 'CHEFE_DEPARTAMENTO';
}

async function confirmArbitration(requestId) {
  arbitrationLoading.value[requestId] = true;
  arbitrationError.value[requestId] = '';
  const amount = arbitrationAmounts.value[requestId];
  const justification = arbitrationJustifications.value[requestId];
  if (!amount || amount <= 0) {
    arbitrationError.value[requestId] = 'Valor inválido';
    arbitrationLoading.value[requestId] = false;
    return;
  }
  if (!justification || !justification.trim()) {
    arbitrationError.value[requestId] = 'Justificativa obrigatória';
    arbitrationLoading.value[requestId] = false;
    return;
  }
  try {
    await api.patch(`/requests/${requestId}/partial-arbitration`, {
      approvedAmountCents: amount,
      justification: justification.trim(),
    });
    // Success: refresh list to show updated status
    await load();
  } catch (e) {
    arbitrationError.value[requestId] = e.response?.data?.error || 'Falha na arbitragem';
  } finally {
    arbitrationLoading.value[requestId] = false;
  }
}

// VOT-04: Check if request can be cancelled (not terminal status)
function canCancel(request) {
  return !['CONCLUIDO', 'CANCELADO'].includes(request.status);
}

// VOT-04: Check if request is in approved status (requires admin/chefe + financial reversal)
function isApprovedStatus(status) {
  return ['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'].includes(status);
}

function openCancelModal(request) {
  cancelModal.value.request = request;
  cancelJustification.value = '';
  cancelError.value = '';
}

function closeCancelModal() {
  cancelModal.value.request = null;
  cancelJustification.value = '';
  cancelError.value = '';
  cancelLoading.value = false;
}

async function confirmCancel() {
  if (!cancelModal.value.request || !cancelJustification.value.trim()) return;
  cancelLoading.value = true;
  cancelError.value = '';
  try {
    await api.post(`/requests/${cancelModal.value.request.id}/cancel`, {
      justification: cancelJustification.value.trim(),
    });
    await load();
    closeCancelModal();
  } catch (e) {
    cancelError.value = e.response?.data?.error || 'Falha ao cancelar';
  } finally {
    cancelLoading.value = false;
  }
}

onMounted(() => {
  restoreDraft();
  auth.me().then(load);
});
</script>