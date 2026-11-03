<template>
  <PageHeader
    eyebrow="Visão geral"
    title="Dashboard"
    description="Saldos, solicitações e prazos do exercício selecionado. Os gráficos respeitam o seu escopo de visibilidade."
  >
    <template #actions>
      <div class="row" role="group" aria-label="Filtros do dashboard">
        <label class="sr-only" for="dash-year">Ano de referência</label>
        <select id="dash-year" class="select" style="min-width: 108px" v-model="year" @change="load">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
        <button type="button" class="btn btn--secondary" :disabled="exporting" @click="exportPDF">
          <span v-if="exporting" class="spinner" aria-hidden="true"></span>
          <Icon v-else name="download" :size="18" />
          {{ exporting ? 'Gerando…' : 'Exportar PDF' }}
        </button>
      </div>
    </template>
  </PageHeader>

  <div v-if="err" class="alert alert--error" role="alert" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="alert-circle" :size="18" />
    <div class="alert__body">{{ err }}</div>
  </div>

  <section aria-label="Indicadores financeiros">
    <div v-if="loading && !bal" class="grid grid--4">
      <div v-for="n in 4" :key="n" class="skeleton skeleton--stat"></div>
    </div>
    <div v-else class="grid grid--4">
      <article class="stat stat--accent">
        <div class="stat__top">
          <span class="stat__label">Disponível</span>
          <span class="stat__icon"><Icon name="wallet" :size="18" /></span>
        </div>
        <div class="stat__value">{{ brl(bal?.availableCents) }}</div>
        <div class="stat__meta">Saldo livre para novas aprovações</div>
      </article>

      <article class="stat">
        <div class="stat__top">
          <span class="stat__label">Provisionado</span>
          <span class="stat__icon"><Icon name="lock" :size="18" /></span>
        </div>
        <div class="stat__value">{{ brl(bal?.provisionedCents) }}</div>
        <div class="stat__meta">Reservado para pedidos aprovados</div>
      </article>

      <article class="stat">
        <div class="stat__top">
          <span class="stat__label">Gasto</span>
          <span class="stat__icon"><Icon name="receipt" :size="18" /></span>
        </div>
        <div class="stat__value">{{ brl(bal?.spentCents) }}</div>
        <div class="stat__meta">Executado no exercício</div>
      </article>

      <article class="stat">
        <div class="stat__top">
          <span class="stat__label">Solicitado</span>
          <span class="stat__icon"><Icon name="file-text" :size="18" /></span>
        </div>
        <div class="stat__value">{{ brl(dash?.totals?.solicitado) }}</div>
        <div class="stat__meta">Aprovado: <b class="text-accent">{{ brl(dash?.totals?.aprovado) }}</b></div>
      </article>
    </div>

    <div v-if="errBal" class="alert alert--error" role="alert" style="margin-top: var(--space-4)">
      <Icon class="alert__icon" name="alert-circle" :size="18" />
      <div class="alert__body">{{ errBal }}</div>
    </div>
  </section>

  <section class="page-section" aria-labelledby="progress-title">
    <article class="card">
      <div class="card__head">
        <div>
          <p class="eyebrow" style="margin-bottom: var(--space-2)">Progresso</p>
          <h2 id="progress-title" class="card__title">Execução do exercício</h2>
          <p class="card__sub">Andamento do gasto sobre o saldo total e distribuição das solicitações por status.</p>
        </div>
      </div>

      <ul class="medidores">
        <li v-for="meter in meters" :key="meter.label" class="medidor" :class="`medidor-${meter.cls}`">
          <span class="medidor-rotulo">{{ meter.label }}</span>
          <span
            class="medidor-trilha"
            role="meter"
            :aria-label="meter.label"
            :aria-valuenow="meter.now"
            aria-valuemin="0"
            :aria-valuemax="meter.max"
          >
            <span class="medidor-fill" :style="{ width: meter.pct + '%' }"></span>
          </span>
          <span class="medidor-valor">{{ meter.value }}</span>
        </li>
      </ul>

      <p v-if="!totalReqs" class="hint" style="margin-top: var(--space-3)">
        Nenhuma solicitação registrada ainda — os medidores mostram o andamento assim que houver pedidos.
      </p>
    </article>
  </section>

  <section class="page-section" aria-labelledby="charts-title">
    <div class="section-head">
      <div>
        <h2 id="charts-title">Composição do exercício {{ year }}</h2>
        <p>Percentuais e valores em BRL. Passe o foco ou o mouse sobre as fatias para ver o detalhe.</p>
      </div>
    </div>

    <div v-if="errDash" class="alert alert--error" role="alert" style="margin-bottom: var(--space-4)">
      <Icon class="alert__icon" name="alert-circle" :size="18" />
      <div class="alert__body">{{ errDash }}</div>
    </div>

    <div class="grid grid--3">
      <article class="card chart-card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Docentes × solicitado</h3>
            <p class="card__sub">Top 8 + Outros</p>
          </div>
        </div>
        <PieChart
          ref="c1"
          :labels="dash?.byDocente?.map((item) => item.name) || []"
          :values="dash?.byDocente?.map((item) => item.totalCents) || []"
        />
      </article>

      <article class="card chart-card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Composição do saldo</h3>
            <p class="card__sub">Disponível · provisionado · gasto</p>
          </div>
        </div>
        <PieChart
          ref="c2"
          :labels="['Disponível', 'Provisionado', 'Gasto']"
          :values="[dash?.bySaldo?.disponivel || 0, dash?.bySaldo?.provisionado || 0, dash?.bySaldo?.gasto || 0]"
        />
      </article>

      <article class="card chart-card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Gastos por categoria</h3>
            <p class="card__sub">Valores aprovados no período</p>
          </div>
        </div>
        <PieChart
          ref="c3"
          :labels="dash?.byCategoria?.map((item) => typeLabel(item.type)) || []"
          :values="dash?.byCategoria?.map((item) => item.totalCents) || []"
        />
      </article>
    </div>
  </section>

  <section class="page-section">
    <div class="grid grid--wide-left">
      <article class="card card--flush">
        <div class="card__head">
          <div>
            <h2 class="card__title">Minhas solicitações</h2>
            <p class="card__sub">Últimos pedidos registrados no sistema.</p>
          </div>
          <router-link class="btn btn--ghost btn--sm" to="/requests">
            Ver todas
            <Icon name="arrow-right" :size="16" />
          </router-link>
        </div>

        <div v-if="errReqs" class="alert alert--error" role="alert" style="margin: var(--space-4) var(--space-5)">
          <Icon class="alert__icon" name="alert-circle" :size="18" />
          <div class="alert__body">{{ errReqs }}</div>
        </div>

        <div v-else-if="loading && !reqs.length" style="padding: var(--space-5)">
          <div class="skeleton skeleton--title" style="margin-bottom: var(--space-4)"></div>
          <div class="skeleton skeleton--text" v-for="n in 4" :key="n" style="margin-bottom: var(--space-3)"></div>
        </div>

        <EmptyState
          v-else-if="!reqs.length"
          icon="file-text"
          title="Nenhuma solicitação ainda"
          text="Crie um rascunho em Solicitações para iniciar o fluxo de aprovação."
        >
          <router-link class="btn btn--sm" to="/requests">Criar solicitação</router-link>
        </EmptyState>

        <div v-else class="request-list">
          <article v-for="request in recentRequests" :key="request.id" class="request-row request-row--compact">
            <div class="request-row__main">
              <router-link class="request-row__title" :to="`/requests`">{{ request.title }}</router-link>
              <div class="request-row__meta">
                <span>{{ typeLabel(request.type) }}</span>
                <span class="dot" aria-hidden="true"></span>
                <span>{{ fmtDate(request.createdAt) }}</span>
              </div>
            </div>
            <StatusBadge :status="request.status" />
            <div class="request-row__value">{{ brl(request.requestedAmountCents) }}</div>
          </article>
        </div>
      </article>

      <aside class="stack" aria-label="Pendências e prazos">
        <article class="card">
          <div class="card__head">
            <div>
              <h2 class="card__title">Precisa de atenção</h2>
              <p class="card__sub">Itens que dependem de você.</p>
            </div>
          </div>

          <ul class="stack stack--tight" style="list-style: none">
            <li class="row row--between" style="padding: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm)">
              <span class="row">
                <Icon name="pencil" :size="17" style="color: var(--text-faint)" />
                <span class="small">Rascunhos para enviar</span>
              </span>
              <span class="badge" :class="draftCount ? 'badge--warning' : 'badge--neutral'">{{ draftCount }}</span>
            </li>
            <li class="row row--between" style="padding: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm)">
              <span class="row">
                <Icon name="gavel" :size="17" style="color: var(--text-faint)" />
                <span class="small">Em votação</span>
              </span>
              <span class="badge" :class="votingCount ? 'badge--warning' : 'badge--neutral'">{{ votingCount }}</span>
            </li>
            <li class="row row--between" style="padding: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm)">
              <span class="row">
                <Icon name="check-circle" :size="17" style="color: var(--text-faint)" />
                <span class="small">Aprovadas</span>
              </span>
              <span class="badge" :class="approvedCount ? 'badge--success' : 'badge--neutral'">{{ approvedCount }}</span>
            </li>
          </ul>

          <router-link class="btn btn--secondary btn--block" to="/requests" style="margin-top: var(--space-4)">
            Abrir solicitações
            <Icon name="arrow-right" :size="16" />
          </router-link>
        </article>

        <article class="card">
          <div class="card__head">
            <div>
              <h2 class="card__title">Prazos de votação</h2>
              <p class="card__sub">Horário de Brasília.</p>
            </div>
          </div>

          <EmptyState
            v-if="!deadlines.length"
            icon="clock"
            title="Nenhum prazo ativo"
            text="Solicitações em votação aparecem aqui com o prazo absoluto."
          />

          <ul v-else class="stack stack--tight" style="list-style: none">
            <li v-for="request in deadlines" :key="request.id" class="stack stack--tight" style="padding: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm)">
              <span class="small" style="font-weight: var(--weight-medium)">{{ request.title }}</span>
              <span class="timeline-badge">
                <Icon name="clock" :size="14" />
                {{ isoToBR(request.votingDeadlineAt) }}
              </span>
            </li>
          </ul>
        </article>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader.vue';
import StatusBadge from '../components/StatusBadge.vue';
import PieChart from '../components/PieChart.vue';
import EmptyState from '../components/EmptyState.vue';
import Icon from '../components/Icon.vue';
import { formatBRL, isoToBR } from '../utils/masks';
import { typeLabel } from '../utils/labels';

const y0 = new Date().getFullYear();
const years = [y0 - 1, y0, y0 + 1];
const year = ref(y0);

const bal = ref(null);
const reqs = ref([]);
const dash = ref(null);
const c1 = ref(null);
const c2 = ref(null);
const c3 = ref(null);

const loading = ref(true);
const exporting = ref(false);
const err = ref('');
const errBal = ref('');
const errReqs = ref('');
const errDash = ref('');

const brl = (cents) => formatBRL(cents);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

const recentRequests = computed(() => reqs.value.slice(0, 5));
const draftCount = computed(() => reqs.value.filter((request) => request.status === 'RASCUNHO').length);
const votingCount = computed(() => reqs.value.filter((request) => ['EM_VOTACAO', 'AGUARDANDO_DESEMPATE'].includes(request.status)).length);
const approvedCount = computed(() => reqs.value.filter((request) => String(request.status).startsWith('APROVADO')).length);
const rejectedCount = computed(() => reqs.value.filter((request) => ['INDEFERIDO', 'CANCELADO'].includes(request.status)).length);
const deadlines = computed(() => reqs.value.filter(
  (request) => ['EM_VOTACAO', 'AGUARDANDO_DESEMPATE'].includes(request.status) && request.votingDeadlineAt,
));

const totalReqs = computed(() => reqs.value.length);
const executionPct = computed(() => {
  const s = dash.value?.bySaldo || {};
  const total = Number(s.disponivel || 0) + Number(s.provisionado || 0) + Number(s.gasto || 0);
  if (!total) return 0;
  return Math.round((Number(s.gasto || 0) / total) * 100);
});

// Medidores clay: valor numérico sempre ao lado da barra (cor nunca é o único portador).
const meters = computed(() => {
  const total = totalReqs.value;
  const pct = (count) => (total ? Math.round((count / total) * 100) : 0);
  const row = (label, cls, count) => ({
    label,
    cls,
    now: count,
    max: Math.max(total, 1),
    pct: pct(count),
    value: String(count),
  });
  return [
    {
      label: 'Execução do gasto',
      cls: 'aprovado',
      now: executionPct.value,
      max: 100,
      pct: executionPct.value,
      value: `${executionPct.value}%`,
    },
    row('Rascunhos', 'rascunho', draftCount.value),
    row('Em votação', 'votacao', votingCount.value),
    row('Aprovadas', 'aprovado', approvedCount.value),
    row('Indeferidas · canceladas', 'indeferido', rejectedCount.value),
  ];
});

async function loadBalance() {
  errBal.value = '';
  try {
    const { data } = await api.get('/settings');
    bal.value = data.balance;
  } catch (e) {
    errBal.value = e.response?.data?.error || 'Falha ao carregar saldos.';
  }
}

async function loadRequests() {
  errReqs.value = '';
  try {
    const { data } = await api.get('/requests?mine=1');
    reqs.value = data.requests || [];
  } catch (e) {
    errReqs.value = e.response?.data?.error || 'Falha ao carregar solicitações.';
  }
}

async function loadDashboard() {
  errDash.value = '';
  try {
    const { data } = await api.get(`/reports/dashboard?year=${year.value}`);
    dash.value = data;
  } catch (e) {
    errDash.value = e.response?.data?.error || 'Falha ao carregar gráficos.';
  }
}

async function load() {
  loading.value = true;
  await Promise.allSettled([loadBalance(), loadRequests(), loadDashboard()]);
  loading.value = false;
}

async function exportPDF() {
  err.value = '';
  exporting.value = true;
  try {
    const images = {
      docentes: c1.value?.toImage() || null,
      saldos: c2.value?.toImage() || null,
      categorias: c3.value?.toImage() || null,
    };
    const { data } = await api.post('/reports/dashboard-pdf', { year: year.value, images }, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha ao gerar PDF.';
  } finally {
    exporting.value = false;
  }
}

onMounted(load);
</script>
