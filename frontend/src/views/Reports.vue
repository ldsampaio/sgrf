<template>
  <PageHeader
    eyebrow="Exportação · prestação de contas"
    title="Relatórios"
    description="Selecione o tipo de relatório, carregue a prévia e exporte em CSV ou PDF quando disponível. Toda geração fica registrada na auditoria."
  />

  <div v-if="err" class="alert alert--error" role="alert" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="alert-circle" :size="18" />
    <div class="alert__body">{{ err }}</div>
  </div>

  <div class="card">
    <div class="report-grid" role="group" aria-label="Tipo de relatório">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="report-option"
        :class="{ 'is-active': kind === option.value }"
        :aria-pressed="kind === option.value"
        @click="selectKind(option.value)"
      >
        <span class="report-option__icon"><Icon :name="option.icon" :size="22" /></span>
        <span class="report-option__label">{{ option.label }}</span>
        <span class="report-option__desc">{{ option.desc }}</span>
      </button>
    </div>

    <hr class="divider" />

    <div class="row row--between">
      <div class="row">
        <button type="button" class="btn" :disabled="loading" @click="load">
          <span v-if="loading" class="spinner" aria-hidden="true"></span>
          <Icon v-else name="refresh" :size="17" />
          {{ loading ? 'Carregando…' : 'Carregar prévia' }}
        </button>

        <a
          v-if="csvSupported"
          class="btn btn--secondary"
          :href="csvUrl"
          :download="`relatorio-${kind}.csv`"
        >
          <Icon name="download" :size="17" />
          Exportar CSV
        </a>

        <a
          v-if="pdfSupported"
          class="btn btn--secondary"
          :href="pdfUrl"
          target="_blank"
          rel="noopener"
        >
          <Icon name="file-text" :size="17" />
          Exportar PDF
        </a>
      </div>

      <p class="hint" style="margin: 0">
        {{ exportHint }}
      </p>
    </div>
  </div>

  <template v-if="data">
    <section class="page-section" aria-labelledby="report-preview-title">
      <div class="section-head">
        <div>
          <h2 id="report-preview-title">{{ activeOption.label }}</h2>
          <p>{{ activeOption.desc }}</p>
        </div>
        <span class="count-pill">{{ rows.length }} registro(s)</span>
      </div>

      <div class="grid grid--4" style="margin-bottom: var(--space-5)">
        <article v-for="item in summary" :key="item.label" class="stat">
          <span class="stat__label">{{ item.label }}</span>
          <span class="stat__value" :class="{ 'text-accent': item.accent }">{{ item.value }}</span>
        </article>
      </div>

      <article class="card card--flush">
        <div v-if="!rows.length" class="empty">
          <div class="empty__icon"><Icon name="file-text" :size="22" /></div>
          <p class="empty__title">Nenhum registro no período</p>
          <p class="empty__text">Não há dados para este relatório com o seu escopo de acesso.</p>
        </div>

        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th v-for="column in columns" :key="column.key" :class="{ num: column.money }">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.id || index">
                <td v-for="column in columns" :key="column.key" :class="{ num: column.money }">
                  <StatusBadge v-if="column.badge" :status="row[column.key]" />
                  <template v-else-if="column.money">{{ formatBRL(row[column.key]) }}</template>
                  <template v-else-if="column.date">{{ isoToBR(row[column.key]) }}</template>
                  <template v-else>{{ column.format ? column.format(row[column.key], row) : (row[column.key] ?? '—') }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article v-if="kind === 'financial' && data.balances?.length" class="card" style="margin-top: var(--space-5)">
        <div class="card__head">
          <div>
            <h3 class="card__title">Saldos por exercício</h3>
            <p class="card__sub">Disponível, provisionado e gasto em centavos convertidos para BRL.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Exercício</th>
                <th class="num">Disponível</th>
                <th class="num">Provisionado</th>
                <th class="num">Gasto</th>
                <th class="num">Versão</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="balance in data.balances" :key="balance.id || balance.referenceYear">
                <td class="strong">{{ balance.referenceYear }}</td>
                <td class="num">{{ formatBRL(balance.availableCents) }}</td>
                <td class="num">{{ formatBRL(balance.provisionedCents) }}</td>
                <td class="num">{{ formatBRL(balance.spentCents) }}</td>
                <td class="num">{{ balance.version ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article v-if="kind === 'voting' && data.vistas?.length" class="card" style="margin-top: var(--space-5)">
        <div class="card__head">
          <div>
            <h3 class="card__title">Pedidos de vista</h3>
            <p class="card__sub">Extensões de prazo registradas no período.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Justificativa</th>
                <th>Prazo anterior</th>
                <th>Novo prazo</th>
                <th>Registrado em</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.vistas" :key="item.id">
                <td class="mono">{{ shortId(item.requestId) }}</td>
                <td>{{ item.justification || '—' }}</td>
                <td>{{ isoToBR(item.deadlineBefore) }}</td>
                <td>{{ isoToBR(item.deadlineAfter) }}</td>
                <td>{{ isoToBR(item.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <details class="card" style="margin-top: var(--space-5)">
        <summary style="cursor: pointer; font-weight: var(--weight-medium); color: var(--text-muted)">Ver dados brutos (JSON)</summary>
        <pre class="pre-block" style="margin-top: var(--space-4)">{{ JSON.stringify(data, null, 2) }}</pre>
      </details>
    </section>
  </template>

  <EmptyState
    v-else-if="!loading"
    class="card"
    style="margin-top: var(--space-5)"
    icon="chart"
    title="Prévia ainda não carregada"
    text="Escolha o tipo de relatório e clique em “Carregar prévia”. A exportação fica disponível em seguida."
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import StatusBadge from '../components/StatusBadge.vue';
import EmptyState from '../components/EmptyState.vue';
import Icon from '../components/Icon.vue';
import { formatBRL, isoToBR } from '../utils/masks';
import { roleLabel, typeLabel, voteLabel } from '../utils/labels';

const auth = useAuth();

const kind = ref('requests');
const data = ref(null);
const loading = ref(false);
const err = ref('');

const ALL_OPTIONS = [
  { value: 'requests', label: 'Solicitações', desc: 'Lista de pedidos com valores e status.', icon: 'file-text', roles: null },
  { value: 'financial', label: 'Financeiro', desc: 'Lançamentos e saldos por exercício.', icon: 'banknote', roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] },
  { value: 'voting', label: 'Votação', desc: 'Votos e pedidos de vista registrados.', icon: 'gavel', roles: null },
  { value: 'accountability', label: 'Prestação de contas', desc: 'Pedidos aprovados e concluídos.', icon: 'receipt', roles: null },
];

const options = computed(() => ALL_OPTIONS.filter((option) => !option.roles || option.roles.includes(auth.user?.role)));
const activeOption = computed(() => options.value.find((option) => option.value === kind.value) || ALL_OPTIONS[0]);

const csvSupported = computed(() => ['requests', 'financial'].includes(kind.value));
const pdfSupported = computed(() => ['requests', 'accountability'].includes(kind.value));
const csvUrl = computed(() => `/api/reports/${kind.value}?format=csv`);
const pdfUrl = computed(() => `/api/reports/${kind.value}?format=pdf`);
const exportHint = computed(() => {
  if (csvSupported.value && pdfSupported.value) return 'CSV e PDF disponíveis para este relatório.';
  if (csvSupported.value) return 'Exportação CSV disponível para este relatório.';
  if (pdfSupported.value) return 'Exportação PDF disponível para este relatório.';
  return 'Este relatório oferece prévia em tela; exportações não estão disponíveis nesta versão.';
});

const shortId = (value) => (value ? String(value).slice(0, 8) : '—');
const yesNo = (value) => (value ? 'Sim' : 'Não');

const COLUMNS = {
  requests: [
    { key: 'title', label: 'Título' },
    { key: 'type', label: 'Tipo', format: typeLabel },
    { key: 'status', label: 'Status', badge: true },
    { key: 'requestedAmountCents', label: 'Solicitado', money: true },
    { key: 'approvedAmountCents', label: 'Aprovado', money: true },
    { key: 'referenceYear', label: 'Ano' },
  ],
  accountability: [
    { key: 'title', label: 'Título' },
    { key: 'type', label: 'Tipo', format: typeLabel },
    { key: 'status', label: 'Status', badge: true },
    { key: 'requestedAmountCents', label: 'Solicitado', money: true },
    { key: 'approvedAmountCents', label: 'Aprovado', money: true },
    { key: 'decidedAt', label: 'Decidido em', date: true },
  ],
  financial: [
    { key: 'type', label: 'Lançamento' },
    { key: 'amountCents', label: 'Valor', money: true },
    { key: 'fromState', label: 'De' },
    { key: 'toState', label: 'Para' },
    { key: 'createdAt', label: 'Data', date: true },
  ],
  voting: [
    { key: 'requestId', label: 'Pedido', format: shortId },
    { key: 'voterId', label: 'Votante', format: shortId },
    { key: 'voteType', label: 'Voto', format: voteLabel },
    { key: 'approvedAmountCents', label: 'Valor', money: true },
    { key: 'tieBreak', label: 'Desempate', format: yesNo },
    { key: 'createdAt', label: 'Data', date: true },
  ],
};

const columns = computed(() => COLUMNS[kind.value] || COLUMNS.requests);

const rows = computed(() => {
  if (!data.value) return [];
  if (kind.value === 'financial') return data.value.transactions || [];
  if (kind.value === 'voting') return data.value.votes || [];
  return data.value.requests || [];
});

const summary = computed(() => {
  if (!data.value) return [];
  if (kind.value === 'requests' || kind.value === 'accountability') {
    const list = data.value.requests || [];
    return [
      { label: 'Registros', value: String(list.length) },
      { label: 'Total solicitado', value: formatBRL(list.reduce((sum, item) => sum + Number(item.requestedAmountCents || 0), 0)) },
      { label: 'Total aprovado', value: formatBRL(list.reduce((sum, item) => sum + Number(item.approvedAmountCents || 0), 0)), accent: true },
      { label: 'Aprovados', value: String(list.filter((item) => String(item.status).startsWith('APROVADO') || item.status === 'CONCLUIDO').length) },
    ];
  }
  if (kind.value === 'financial') {
    const list = data.value.transactions || [];
    return [
      { label: 'Transações', value: String(list.length) },
      { label: 'Soma dos valores', value: formatBRL(list.reduce((sum, item) => sum + Number(item.amountCents || 0), 0)), accent: true },
      { label: 'Exercícios com saldo', value: String((data.value.balances || []).length) },
      { label: 'Perfil', value: roleLabel(auth.user?.role) },
    ];
  }
  return [
    { label: 'Votos', value: String((data.value.votes || []).length), accent: true },
    { label: 'Pedidos de vista', value: String((data.value.vistas || []).length) },
  ];
});

function selectKind(value) {
  kind.value = value;
  data.value = null;
  err.value = '';
}

async function load() {
  err.value = '';
  loading.value = true;
  try {
    const { data: response } = await api.get(`/reports/${kind.value}`);
    data.value = response;
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha ao carregar o relatório.';
  } finally {
    loading.value = false;
  }
}
</script>
