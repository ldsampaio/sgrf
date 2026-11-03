<template>
  <PageHeader
    eyebrow="Rascunho · submissão · acompanhamento"
    title="Solicitações"
    description="Crie rascunhos, envie para aprovação e acompanhe cada mudança de status com valores em BRL."
  >
    <template #actions>
      <button type="button" class="btn" @click="openNew">
        <Icon name="plus" :size="18" />
        Nova solicitação
      </button>
    </template>
  </PageHeader>

  <div v-if="flash" class="alert alert--success" role="status" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="check-circle" :size="18" />
    <div class="alert__body">{{ flash }}</div>
  </div>

  <div v-if="err" class="alert alert--error" role="alert" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="alert-circle" :size="18" />
    <div class="alert__body">{{ err }}</div>
  </div>

  <article class="card card--flush">
    <div class="filter-bar">
      <div class="search">
        <Icon name="search" :size="18" />
        <input v-model="q" class="input" type="search" placeholder="Buscar por título…" aria-label="Buscar solicitações por título" />
      </div>

      <label class="sr-only" for="status-filter">Filtrar por status</label>
      <select id="status-filter" v-model="statusFilter" class="select" style="width: auto; min-width: 160px">
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>

      <label class="sr-only" for="type-filter">Filtrar por tipo</label>
      <select id="type-filter" v-model="typeFilter" class="select" style="width: auto; min-width: 170px">
        <option value="TODOS">Todos os tipos</option>
        <option v-for="type in TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
      </select>

      <span class="count-pill">
        <Icon name="filter" :size="13" />
        {{ filtered.length }} de {{ list.length }}
      </span>
    </div>

    <div v-if="loading" style="padding: var(--space-5)">
      <div class="skeleton skeleton--title" style="margin-bottom: var(--space-4)"></div>
      <div v-for="n in 4" :key="n" class="skeleton skeleton--text" style="margin-bottom: var(--space-3)"></div>
    </div>

    <EmptyState
      v-else-if="!list.length"
      icon="file-text"
      title="Nenhuma solicitação registrada"
      text="Comece criando um rascunho. Você pode salvar, revisar e submeter quando estiver pronto."
    >
      <button type="button" class="btn btn--sm" @click="openNew">
        <Icon name="plus" :size="16" />
        Criar rascunho
      </button>
    </EmptyState>

    <EmptyState
      v-else-if="!filtered.length"
      icon="search"
      title="Nada encontrado com esses filtros"
      text="Ajuste a busca ou limpe os filtros para ver todas as solicitações."
    >
      <button type="button" class="btn btn--ghost btn--sm" @click="clearFilters">Limpar filtros</button>
    </EmptyState>

    <div v-else class="request-list">
      <article v-for="request in filtered" :key="request.id" class="request-row">
        <div class="request-row__main">
          <span class="request-row__title" :title="request.title">{{ request.title }}</span>
          <div class="request-row__meta">
            <span class="row" style="gap: 5px">
              <Icon :name="typeIcon(request.type)" :size="13" />
              {{ typeLabel(request.type) }}
            </span>
            <span class="dot" aria-hidden="true"></span>
            <span>{{ fmtDate(request.createdAt) }}</span>
            <span v-if="request.referenceYear" class="dot" aria-hidden="true"></span>
            <span v-if="request.referenceYear">Exercício {{ request.referenceYear }}</span>
          </div>
        </div>

        <StatusBadge :status="request.status" />
        <div class="request-row__value">{{ formatBRL(request.requestedAmountCents) }}</div>

        <div class="request-row__actions">
          <button
            v-if="request.status === 'RASCUNHO'"
            type="button"
            class="btn btn--sm"
            :disabled="submittingId === request.id"
            @click="submit(request.id)"
          >
            <span v-if="submittingId === request.id" class="spinner" aria-hidden="true"></span>
            {{ submittingId === request.id ? 'Enviando…' : 'Submeter' }}
          </button>

          <button
            v-else-if="isArbitrationState(request) && isChefe"
            type="button"
            class="btn btn--secondary btn--sm"
            @click="openArbitration(request)"
          >
            <Icon name="scale" :size="16" />
            Arbitrar
          </button>

          <span v-else-if="isArbitrationState(request)" class="badge badge--warning">Aguardando chefia</span>

          <button
            v-else-if="canCancel(request)"
            type="button"
            class="btn btn--ghost btn--sm"
            @click="openCancel(request)"
          >
            Cancelar
          </button>
        </div>
      </article>
    </div>
  </article>

  <!-- Nova solicitação -->
  <Modal
    :open="newOpen"
    title="Nova solicitação"
    subtitle="O rascunho fica salvo nesta sessão até você submeter."
    size="lg"
    @close="closeNew"
  >
    <form id="new-request-form" class="stack" @submit.prevent="create">
      <div v-if="formErr" class="alert alert--error" role="alert">
        <Icon class="alert__icon" name="alert-circle" :size="18" />
        <div class="alert__body">{{ formErr }}</div>
      </div>

      <fieldset class="fieldset">
        <legend class="field__label">Tipo <span class="required" aria-hidden="true">*</span></legend>
        <div class="type-grid" role="group" aria-label="Tipo de solicitação">
          <button
            v-for="type in TYPES"
            :key="type.value"
            type="button"
            class="type-option"
            :class="{ 'is-active': form.type === type.value }"
            :aria-pressed="form.type === type.value"
            @click="form.type = type.value"
          >
            <Icon :name="type.icon" :size="20" />
            <span class="type-option__label">{{ type.label }}</span>
            <span class="type-option__hint">{{ type.hint }}</span>
          </button>
        </div>
        <p class="field__hint">O tipo define o cálculo e os campos obrigatórios do pedido.</p>
      </fieldset>

      <div class="field">
        <label class="field__label" for="new-title">Título <span class="required" aria-hidden="true">*</span></label>
        <input id="new-title" v-model="form.title" class="input" required placeholder="Ex.: Compra de servidor para o laboratório" />
      </div>

      <div class="field">
        <label class="field__label" for="new-justification">Justificativa</label>
        <textarea id="new-justification" v-model="form.justification" class="textarea" rows="3" placeholder="Explique a necessidade e o impacto do pedido."></textarea>
      </div>

      <MoneyInput
        v-model="valueCents"
        label="Valor estimado (R$)"
        hint="Máscara BRL automática; o valor é armazenado em centavos."
      />

      <div v-if="form.type === 'EQUIPAMENTO'" class="field">
        <label class="field__label" for="new-spec">Especificação técnica <span class="required" aria-hidden="true">*</span></label>
        <input id="new-spec" v-model="form.spec" class="input" placeholder="Modelo, quantidade e requisitos mínimos" />
        <p class="field__hint">Obrigatória para equipamentos (RN-006).</p>
      </div>

      <div class="summary-panel" aria-live="polite">
        <span class="summary-panel__label">Total estimado</span>
        <strong class="summary-panel__value">{{ formatBRL(valueCents) }}</strong>
      </div>

      <p class="hint">
        {{ typeHint }}
      </p>
    </form>

    <template #footer>
      <button type="button" class="btn btn--ghost" @click="closeNew">Cancelar</button>
      <button type="submit" form="new-request-form" class="btn" :disabled="saving">
        <span v-if="saving" class="spinner" aria-hidden="true"></span>
        {{ saving ? 'Salvando…' : 'Criar rascunho' }}
      </button>
    </template>
  </Modal>

  <!-- Arbitragem (chefia) -->
  <Modal
    :open="Boolean(arb.request)"
    title="Arbitragem de voto parcial"
    subtitle="Defina o valor final aprovado e registre a justificativa."
    size="sm"
    @close="closeArbitration"
  >
    <div class="stack">
      <div class="alert alert--warning" role="alert">
        <Icon class="alert__icon" name="alert-triangle" :size="18" />
        <div class="alert__body">
          <span class="alert__title">{{ arb.request?.title }}</span>
          A votação terminou com posições divergentes. Sua decisão encerra o pedido.
        </div>
      </div>

      <p class="small muted">
        Valor solicitado: <b class="text-accent">{{ formatBRL(arb.request?.requestedAmountCents) }}</b>
      </p>

      <MoneyInput
        v-model="arb.amount"
        label="Valor aprovado final (R$)"
        hint="Entre 1 centavo e o valor solicitado."
        :min="1"
        :max="arb.request?.requestedAmountCents || 0"
      />

      <div class="field">
        <label class="field__label" for="arb-justification">Justificativa <span class="required" aria-hidden="true">*</span></label>
        <textarea id="arb-justification" v-model="arb.justification" class="textarea" rows="3" placeholder="Justificativa obrigatória para a arbitragem."></textarea>
      </div>

      <div v-if="arb.error" class="alert alert--error" role="alert">
        <Icon class="alert__icon" name="alert-circle" :size="18" />
        <div class="alert__body">{{ arb.error }}</div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn--ghost" @click="closeArbitration">Voltar</button>
      <button type="button" class="btn" :disabled="arb.loading" @click="confirmArbitration">
        <span v-if="arb.loading" class="spinner" aria-hidden="true"></span>
        {{ arb.loading ? 'Confirmando…' : 'Confirmar arbitragem' }}
      </button>
    </template>
  </Modal>

  <!-- Cancelamento -->
  <Modal
    :open="Boolean(cancelModal.request)"
    title="Cancelar solicitação"
    :subtitle="cancelModal.request?.title"
    size="sm"
    @close="closeCancelModal"
  >
    <div class="stack">
      <div class="row">
        <span class="small muted">Status atual:</span>
        <StatusBadge :status="cancelModal.request?.status" />
      </div>

      <div v-if="isApprovedStatus(cancelModal.request?.status)" class="alert alert--warning" role="alert">
        <Icon class="alert__icon" name="alert-triangle" :size="18" />
        <div class="alert__body">
          <span class="alert__title">Reversão financeira necessária</span>
          Esta solicitação está aprovada/provisionada. O cancelamento exige perfil de administrador ou chefia.
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="cancel-justification">Justificativa <span class="required" aria-hidden="true">*</span></label>
        <textarea id="cancel-justification" v-model="cancelJustification" class="textarea" rows="3" placeholder="Justificativa obrigatória."></textarea>
      </div>

      <div v-if="cancelError" class="alert alert--error" role="alert">
        <Icon class="alert__icon" name="alert-circle" :size="18" />
        <div class="alert__body">{{ cancelError }}</div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn--ghost" :disabled="cancelLoading" @click="closeCancelModal">Voltar</button>
      <button type="button" class="btn btn--danger" :disabled="cancelLoading || !cancelJustification.trim()" @click="confirmCancel">
        <span v-if="cancelLoading" class="spinner" aria-hidden="true"></span>
        {{ cancelLoading ? 'Cancelando…' : 'Confirmar cancelamento' }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '../stores/auth';
import { api } from '../services/api';
import MoneyInput from '../components/MoneyInput.vue';
import StatusBadge from '../components/StatusBadge.vue';
import PageHeader from '../components/PageHeader.vue';
import Modal from '../components/Modal.vue';
import EmptyState from '../components/EmptyState.vue';
import Icon from '../components/Icon.vue';
import { formatBRL } from '../utils/masks';
import { typeLabel } from '../utils/labels';

const auth = useAuth();

const TYPES = [
  { value: 'EQUIPAMENTO', label: 'Equipamento', icon: 'package', hint: 'Especificação técnica obrigatória' },
  { value: 'PUBLICACAO', label: 'Publicação', icon: 'file-text', hint: 'Taxa de publicação' },
  { value: 'VIAGEM', label: 'Viagem', icon: 'plane', hint: 'Diárias e passagens' },
  { value: 'AUXILIO_ESTUDANTIL', label: 'Auxílio estudantil', icon: 'graduation', hint: 'Apoio a estudantes' },
];

const statusOptions = [
  { value: 'TODOS', label: 'Todos os status' },
  { value: 'RASCUNHO', label: 'Rascunhos' },
  { value: 'EM_VOTACAO', label: 'Em votação' },
  { value: 'APROVADO', label: 'Aprovadas' },
  { value: 'INDEFERIDO', label: 'Indeferidas' },
  { value: 'CANCELADO', label: 'Canceladas' },
];

const list = ref([]);
const loading = ref(true);
const saving = ref(false);
const err = ref('');
const flash = ref('');
const formErr = ref('');
const form = ref({ type: 'EQUIPAMENTO', title: '', justification: '', spec: '' });
const valueCents = ref(0);
const newOpen = ref(false);
const submittingId = ref('');
const q = ref('');
const statusFilter = ref('TODOS');
const typeFilter = ref('TODOS');
const DRAFT_KEY = 'sgrf:pending-draft';
let flashTimer = null;

const isChefe = computed(() => auth.user?.role === 'CHEFE_DEPARTAMENTO');

const typeIcon = (type) => TYPES.find((t) => t.value === type)?.icon || 'file-text';
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

const typeHint = computed(() => {
  if (form.value.type === 'EQUIPAMENTO') return 'Equipamentos exigem especificação técnica e passam pelo cálculo de valor estimado.';
  if (form.value.type === 'PUBLICACAO') return 'O valor estimado é tratado como taxa de publicação.';
  if (form.value.type === 'VIAGEM') return 'O valor estimado representa diárias e passagens; o câmbio é aplicado pelo backend quando necessário.';
  return 'O valor estimado representa o auxílio solicitado ao departamento.';
});

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  return list.value.filter((request) => {
    if (needle) {
      const haystack = `${request.title} ${typeLabel(request.type)}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (typeFilter.value !== 'TODOS' && request.type !== typeFilter.value) return false;
    return matchesStatus(request.status, statusFilter.value);
  });
});

function matchesStatus(status, filter) {
  if (filter === 'TODOS') return true;
  if (filter === 'APROVADO') return String(status).startsWith('APROVADO') || status === 'CONCLUIDO';
  if (filter === 'EM_VOTACAO') return ['EM_VOTACAO', 'AGUARDANDO_DESEMPATE'].includes(status);
  return status === filter;
}

function clearFilters() {
  q.value = '';
  statusFilter.value = 'TODOS';
  typeFilter.value = 'TODOS';
}

function openNew() {
  formErr.value = '';
  newOpen.value = true;
}

function closeNew() {
  newOpen.value = false;
  formErr.value = '';
}

function showFlash(message) {
  flash.value = message;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash.value = ''; }, 6000);
}

// ——— Draft persistence (session-scoped, best effort) ———
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

watch(
  [() => form.value.type, () => form.value.title, () => form.value.justification, () => form.value.spec, valueCents],
  persistDraft,
  { flush: 'sync' },
);

function restoreDraft() {
  suppressPersist = true;
  let restored = false;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (draft && typeof draft.title === 'string') {
      const values = TYPES.map((t) => t.value);
      form.value.type = values.includes(draft.type) ? draft.type : form.value.type;
      form.value.title = draft.title ?? '';
      form.value.justification = typeof draft.justification === 'string' ? draft.justification : '';
      form.value.spec = typeof draft.spec === 'string' ? draft.spec : '';
      valueCents.value = Number.isFinite(draft.valueCents) ? draft.valueCents : 0;
      restored = Boolean(draft.title || draft.justification || draft.valueCents);
    }
  } catch { /* corrupt slot → open empty (D-11) */ }
  finally {
    clearDraft();
    suppressPersist = false;
  }
  return restored;
}

// ——— Data ———
async function load() {
  err.value = '';
  try {
    const { data } = await api.get('/requests');
    list.value = data.requests || [];
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha ao carregar solicitações.';
  } finally {
    loading.value = false;
  }
}

async function create() {
  formErr.value = '';
  if (!form.value.title.trim()) {
    formErr.value = 'Informe um título para o rascunho.';
    return;
  }
  if (valueCents.value <= 0) {
    formErr.value = 'Informe um valor estimado maior que zero.';
    return;
  }
  if (form.value.type === 'EQUIPAMENTO' && !form.value.spec.trim()) {
    formErr.value = 'A especificação técnica é obrigatória para equipamentos.';
    return;
  }

  saving.value = true;
  try {
    const amount = valueCents.value / 100;
    await api.post('/requests', {
      type: form.value.type,
      title: form.value.title.trim(),
      justification: form.value.justification,
      payload: {
        estimatedValue: amount,
        publicationFee: amount,
        estimatedAmount: amount,
        technicalSpecification: form.value.spec.trim() || 'n/a',
        dailyCount: 1,
        dailyRate: amount,
        passageAmount: 0,
        currency: 'BRL',
      },
    });
    suppressPersist = true;
    form.value.title = '';
    form.value.justification = '';
    form.value.spec = '';
    form.value.type = 'EQUIPAMENTO';
    valueCents.value = 0;
    clearDraft();
    suppressPersist = false;
    closeNew();
    showFlash('Rascunho criado. Use “Submeter” quando estiver pronto para enviar.');
    await load();
  } catch (e) {
    formErr.value = e.response?.data?.error || 'Não foi possível criar o rascunho.';
  } finally {
    saving.value = false;
  }
}

async function submit(id) {
  err.value = '';
  submittingId.value = id;
  try {
    await api.post(`/requests/${id}/submit`);
    showFlash('Solicitação submetida. O status foi atualizado conforme as regras de aprovação.');
    await load();
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha ao submeter a solicitação.';
  } finally {
    submittingId.value = '';
  }
}

// ——— Arbitragem (VOT-03) ———
const arb = ref({ request: null, amount: 0, justification: '', loading: false, error: '' });

function isArbitrationState(request) {
  return request.status === 'APROVADO_PARCIALMENTE' && request.decisionReason === 'AGUARDANDO_ARBITRAGEM';
}

function openArbitration(request) {
  arb.value = { request, amount: 0, justification: '', loading: false, error: '' };
}

function closeArbitration() {
  arb.value = { request: null, amount: 0, justification: '', loading: false, error: '' };
}

async function confirmArbitration() {
  if (!arb.value.request) return;
  arb.value.error = '';
  if (!arb.value.amount || arb.value.amount <= 0) {
    arb.value.error = 'Informe um valor aprovado maior que zero.';
    return;
  }
  if (!arb.value.justification.trim()) {
    arb.value.error = 'A justificativa é obrigatória para a arbitragem.';
    return;
  }
  arb.value.loading = true;
  try {
    await api.patch(`/requests/${arb.value.request.id}/partial-arbitration`, {
      approvedAmountCents: arb.value.amount,
      justification: arb.value.justification.trim(),
    });
    closeArbitration();
    showFlash('Arbitragem registrada e solicitação atualizada.');
    await load();
  } catch (e) {
    arb.value.error = e.response?.data?.error || 'Falha na arbitragem.';
  } finally {
    arb.value.loading = false;
  }
}

// ——— Cancelamento (VOT-04) ———
const cancelModal = ref({ request: null });
const cancelJustification = ref('');
const cancelLoading = ref(false);
const cancelError = ref('');

function canCancel(request) {
  return !['CONCLUIDO', 'CANCELADO'].includes(request.status);
}

function isApprovedStatus(status) {
  return ['APROVADO', 'APROVADO_AUTOMATICAMENTE', 'APROVADO_PARCIALMENTE'].includes(status);
}

function openCancel(request) {
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
    closeCancelModal();
    showFlash('Solicitação cancelada.');
    await load();
  } catch (e) {
    cancelError.value = e.response?.data?.error || 'Falha ao cancelar.';
  } finally {
    cancelLoading.value = false;
  }
}

onMounted(() => {
  const restored = restoreDraft();
  if (restored) newOpen.value = true;
  auth.me().then(load);
});
</script>
