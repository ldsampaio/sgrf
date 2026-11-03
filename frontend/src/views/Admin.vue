<template>
  <PageHeader
    eyebrow="Área restrita"
    title="Administração"
    description="Gerencie usuários, parâmetros financeiros, saldo departamental e importação em lote. Toda alteração é auditada."
  >
    <template #actions>
      <span class="badge badge--info">{{ roleLabel(auth.user?.role) }}</span>
      <button type="button" class="btn btn--ghost btn--sm" :disabled="refreshing" @click="refreshAll">
        <span v-if="refreshing" class="spinner" aria-hidden="true"></span>
        <Icon v-else name="refresh" :size="16" />
        Atualizar
      </button>
    </template>
  </PageHeader>

  <div v-if="flash" class="alert alert--success" role="status" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="check-circle" :size="18" />
    <div class="alert__body">{{ flash }}</div>
  </div>

  <div v-if="pageErr" class="alert alert--error" role="alert" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="alert-circle" :size="18" />
    <div class="alert__body">{{ pageErr }}</div>
  </div>

  <div class="tabs" role="tablist" aria-label="Seções da administração">
    <button
      v-for="(item, index) in TABS"
      :id="`admin-tab-${item.id}`"
      :key="item.id"
      type="button"
      class="tab"
      role="tab"
      :aria-selected="tab === item.id"
      :aria-controls="`admin-panel-${item.id}`"
      :tabindex="tab === item.id ? 0 : -1"
      @click="tab = item.id"
      @keydown="onTabKey($event, index)"
    >
      <Icon :name="item.icon" :size="17" />
      {{ item.label }}
    </button>
  </div>

  <!-- USUÁRIOS -->
  <section v-if="tab === 'users'" id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users" class="stack">
    <article class="card card--flush">
      <div class="filter-bar">
        <div class="search">
          <Icon name="search" :size="18" />
          <input v-model="userQuery" class="input" type="search" placeholder="Buscar por nome ou e-mail…" aria-label="Buscar usuários" />
        </div>

        <label class="sr-only" for="user-role-filter">Filtrar por papel</label>
        <select id="user-role-filter" v-model="userRoleFilter" class="select" style="width: auto; min-width: 170px">
          <option value="TODOS">Todos os papéis</option>
          <option v-for="role in ROLE_OPTIONS" :key="role" :value="role">{{ roleLabel(role) }}</option>
        </select>

        <span class="count-pill">{{ filteredUsers.length }} de {{ users.length }}</span>
      </div>

      <div v-if="usersErr" class="alert alert--error" role="alert" style="margin: var(--space-4) var(--space-5)">
        <Icon class="alert__icon" name="alert-circle" :size="18" />
        <div class="alert__body">{{ usersErr }}</div>
      </div>

      <div v-else-if="usersLoading" style="padding: var(--space-5)">
        <div v-for="n in 5" :key="n" class="skeleton skeleton--text" style="margin-bottom: var(--space-3)"></div>
      </div>

      <div v-else-if="!filteredUsers.length" class="empty">
        <div class="empty__icon"><Icon name="users" :size="22" /></div>
        <p class="empty__title">Nenhum usuário encontrado</p>
        <p class="empty__text">Ajuste a busca ou importe usuários em lote.</p>
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>
                <div class="row" style="gap: var(--space-3); flex-wrap: nowrap">
                  <span class="avatar avatar--sm" aria-hidden="true">{{ initials(user.name) }}</span>
                  <div style="min-width: 0">
                    <div class="strong">{{ user.name }}</div>
                    <div class="hint">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <label class="sr-only" :for="`role-${user.id}`">Papel de {{ user.name }}</label>
                <select
                  :id="`role-${user.id}`"
                  class="select"
                  style="min-width: 170px"
                  :value="user.role"
                  :disabled="userBusy === user.id || !canManage(user)"
                  @change="changeRole(user, $event)"
                >
                  <option v-for="role in roleOptionsFor(user)" :key="role" :value="role">{{ roleLabel(role) }}</option>
                </select>
              </td>
              <td>
                <span class="badge" :class="user.status === 'ATIVO' ? 'badge--success' : 'badge--neutral'">
                  <span class="badge__dot" aria-hidden="true"></span>
                  {{ user.status === 'ATIVO' ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="nowrap">{{ user.lastLoginAt ? isoToBR(user.lastLoginAt) : 'Nunca acessou' }}</td>
              <td>
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  :disabled="userBusy === user.id || !canManage(user)"
                  @click="resendInvite(user)"
                >
                  <Icon name="mail" :size="16" />
                  Reenviar convite
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <p class="hint">
      Chefia pode gerenciar usuários comuns; apenas administradores alteram o papel de outros administradores.
    </p>
  </section>

  <!-- PARÂMETROS -->
  <section v-else-if="tab === 'settings'" id="admin-panel-settings" role="tabpanel" aria-labelledby="admin-tab-settings" class="stack">
    <div class="grid grid--2">
      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Parâmetros financeiros</h2>
            <p class="card__sub">Limite de aprovação automática, câmbio e duração da votação.</p>
          </div>
        </div>

        <form class="stack" @submit.prevent="saveFinancial">
          <MoneyInput
            v-model="financialForm.automaticApprovalLimitCents"
            label="Limite de aprovação automática (R$)"
            hint="Pedidos até este valor anual são aprovados automaticamente."
          />

          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="exchange-rate">Taxa de câmbio (BRL/USD)</label>
              <input id="exchange-rate" v-model.number="financialForm.currentExchangeRate" class="input" type="number" min="0" step="0.0001" inputmode="decimal" />
              <p class="field__hint">Aplicada apenas quando o valor original está em dólar.</p>
            </div>
            <div class="field">
              <label class="field__label" for="voting-hours">Duração da votação (horas)</label>
              <input id="voting-hours" v-model.number="financialForm.votingDurationHours" class="input" type="number" min="1" step="1" inputmode="numeric" />
              <p class="field__hint">Prazo padrão a partir da submissão.</p>
            </div>
          </div>

          <div class="row">
            <button type="submit" class="btn" :disabled="savingFinancial || !settings">
              <span v-if="savingFinancial" class="spinner" aria-hidden="true"></span>
              {{ savingFinancial ? 'Salvando…' : 'Salvar parâmetros' }}
            </button>
            <span class="hint">Atualizado em {{ settings?.updatedAt ? isoToBR(settings.updatedAt) : '—' }}</span>
          </div>

          <div v-if="financialErr" class="alert alert--error" role="alert">
            <Icon class="alert__icon" name="alert-circle" :size="18" />
            <div class="alert__body">{{ financialErr }}</div>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Saldo departamental</h2>
            <p class="card__sub">Ajuste por exercício. Alterações concorrentes são bloqueadas pelo servidor.</p>
          </div>
          <span v-if="balance" class="badge badge--neutral">v{{ balance.version }}</span>
        </div>

        <form class="stack" @submit.prevent="saveBalance">
          <div class="field">
            <label class="field__label" for="balance-year">Exercício</label>
            <input id="balance-year" v-model.number="balanceForm.referenceYear" class="input" type="number" min="2000" max="2100" step="1" inputmode="numeric" />
          </div>

          <MoneyInput v-model="balanceForm.availableCents" label="Disponível (R$)" hint="Saldo livre para novas aprovações." />
          <MoneyInput v-model="balanceForm.provisionedCents" label="Provisionado (R$)" hint="Reservado para pedidos aprovados." />
          <MoneyInput v-model="balanceForm.spentCents" label="Gasto (R$)" hint="Executado no exercício." />

          <div class="row">
            <button type="submit" class="btn" :disabled="savingBalance">
              <span v-if="savingBalance" class="spinner" aria-hidden="true"></span>
              {{ savingBalance ? 'Salvando…' : 'Salvar saldo' }}
            </button>
            <span class="hint">Uma nova versão é criada a cada ajuste.</span>
          </div>

          <div v-if="balanceErr" class="alert alert--error" role="alert">
            <Icon class="alert__icon" name="alert-circle" :size="18" />
            <div class="alert__body">{{ balanceErr }}</div>
          </div>
        </form>
      </article>
    </div>

    <article v-if="isAdmin" class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">E-mail institucional</h2>
          <p class="card__sub">SMTP é configurado por variáveis de ambiente nesta versão.</p>
        </div>
        <span class="badge" :class="settings?.smtpConfigured ? 'badge--success' : 'badge--neutral'">
          <span class="badge__dot" aria-hidden="true"></span>
          {{ settings?.smtpConfigured ? 'SMTP configurado' : 'SMTP desligado' }}
        </span>
      </div>

      <div class="row row--between">
        <p class="hint" style="margin: 0">Envie um e-mail de teste para <b>{{ auth.user?.email }}</b> e confirme a entrega.</p>
        <button type="button" class="btn btn--secondary btn--sm" :disabled="emailTesting" @click="testEmail">
          <span v-if="emailTesting" class="spinner" aria-hidden="true"></span>
          <Icon v-else name="send" :size="16" />
          Enviar teste
        </button>
      </div>

      <div v-if="emailMsg" class="alert alert--info" role="status" style="margin-top: var(--space-4)">
        <Icon class="alert__icon" name="info" :size="18" />
        <div class="alert__body">{{ emailMsg }}</div>
      </div>
    </article>

    <article class="card card--flush">
      <div class="card__head">
        <div>
          <h2 class="card__title">Últimos lançamentos financeiros</h2>
          <p class="card__sub">100 transações mais recentes.</p>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" :disabled="txLoading" @click="loadTransactions">
          <span v-if="txLoading" class="spinner" aria-hidden="true"></span>
          <Icon v-else name="refresh" :size="16" />
          Recarregar
        </button>
      </div>

      <div v-if="txErr" class="alert alert--error" role="alert" style="margin: var(--space-4) var(--space-5)">
        <Icon class="alert__icon" name="alert-circle" :size="18" />
        <div class="alert__body">{{ txErr }}</div>
      </div>

      <div v-else-if="!transactions.length" class="empty">
        <div class="empty__icon"><Icon name="banknote" :size="22" /></div>
        <p class="empty__title">Nenhum lançamento</p>
        <p class="empty__text">Ajustes de saldo, provisões e gastos aparecem aqui.</p>
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead><tr><th>Tipo</th><th class="num">Valor</th><th>De</th><th>Para</th><th>Data</th></tr></thead>
          <tbody>
            <tr v-for="transaction in transactions" :key="transaction.id">
              <td class="strong">{{ transaction.type }}</td>
              <td class="num">{{ formatBRL(transaction.amountCents) }}</td>
              <td>{{ transaction.fromState || '—' }}</td>
              <td>{{ transaction.toState || '—' }}</td>
              <td class="nowrap">{{ isoToBR(transaction.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>

  <!-- IMPORTAÇÃO -->
  <section v-else id="admin-panel-import" role="tabpanel" aria-labelledby="admin-tab-import" class="stack">
    <article class="card card--accent">
      <div class="card__head">
        <div>
          <h2 class="card__title">Importar lote de usuários</h2>
          <p class="card__sub">Arquivo JSON com até 200 registros. Pré-visualize antes de confirmar.</p>
        </div>
        <span class="badge badge--info">Somente admin</span>
      </div>

      <div class="alert alert--info" role="note" style="margin-bottom: var(--space-4)">
        <Icon class="alert__icon" name="info" :size="18" />
        <div class="alert__body">
          Formato esperado: <code>[{"name":"...","email":"...@utfpr.edu.br","role":"PROFESSOR"}]</code>
        </div>
      </div>

      <div class="row">
        <input
          id="batch-file"
          class="input"
          type="file"
          accept=".json,application/json"
          style="flex: 1 1 260px"
          @change="pick"
        />
        <button type="button" class="btn btn--secondary" :disabled="!file || importing" @click="preview">
          <span v-if="importing && importAction === 'preview'" class="spinner" aria-hidden="true"></span>
          <Icon v-else name="search" :size="16" />
          Pré-visualizar
        </button>
        <button type="button" class="btn" :disabled="!file || importing" @click="confirmImport">
          <span v-if="importing && importAction === 'confirm'" class="spinner" aria-hidden="true"></span>
          <Icon v-else name="upload" :size="16" />
          Confirmar importação
        </button>
      </div>

      <p v-if="file" class="hint" style="margin-top: var(--space-3)">Arquivo selecionado: {{ file.name }}</p>

      <div v-if="importErr" class="alert alert--error" role="alert" style="margin-top: var(--space-4)">
        <Icon class="alert__icon" name="alert-circle" :size="18" />
        <div class="alert__body">{{ importErr }}</div>
      </div>

      <template v-if="importResult">
        <hr class="divider" />
        <div class="meta-grid">
          <div v-for="(value, key) in importResult.summary || {}" :key="key" class="meta">
            <div class="meta__label">{{ key }}</div>
            <div class="meta__value">{{ String(value) }}</div>
          </div>
        </div>

        <div v-if="importValid.length" class="table-wrap" style="margin-top: var(--space-5)">
          <table class="table">
            <thead><tr><th>E-mail</th><th>Papel / resultado</th></tr></thead>
            <tbody>
              <tr v-for="item in importValid" :key="item.email || item.index">
                <td>{{ item.email || '—' }}</td>
                <td>{{ item.role ? roleLabel(item.role) : 'Criado' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="importInvalid.length" class="alert alert--error" role="alert" style="margin-top: var(--space-4)">
          <Icon class="alert__icon" name="alert-triangle" :size="18" />
          <div class="alert__body">
            <span class="alert__title">{{ importInvalid.length }} registro(s) inválido(s)</span>
            <ul style="margin: var(--space-2) 0 0; padding-left: var(--space-4)">
              <li v-for="item in importInvalid" :key="`${item.email}-${item.index}`">{{ item.email || '—' }} — {{ item.error || 'erro' }}</li>
            </ul>
          </div>
        </div>
      </template>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import MoneyInput from '../components/MoneyInput.vue';
import Icon from '../components/Icon.vue';
import { formatBRL, isoToBR } from '../utils/masks';
import { initials, roleLabel } from '../utils/labels';

const auth = useAuth();

const TABS = [
  { id: 'users', label: 'Usuários', icon: 'users' },
  { id: 'settings', label: 'Parâmetros', icon: 'settings' },
  { id: 'import', label: 'Importar lote', icon: 'upload' },
];
const ROLE_OPTIONS = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'];

const tab = ref('users');
const flash = ref('');
const pageErr = ref('');
const refreshing = ref(false);
let flashTimer = null;

const isAdmin = computed(() => auth.user?.role === 'ADMINISTRADOR');

function showFlash(message) {
  flash.value = message;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash.value = ''; }, 6000);
}

function onTabKey(event, index) {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  let next = index;
  if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
  if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = TABS.length - 1;
  tab.value = TABS[next].id;
  document.getElementById(`admin-tab-${TABS[next].id}`)?.focus();
}

// ——— Users ———
const users = ref([]);
const usersLoading = ref(true);
const usersErr = ref('');
const userQuery = ref('');
const userRoleFilter = ref('TODOS');
const userBusy = ref('');

const filteredUsers = computed(() => {
  const needle = userQuery.value.trim().toLowerCase();
  return users.value.filter((user) => {
    if (userRoleFilter.value !== 'TODOS' && user.role !== userRoleFilter.value) return false;
    if (!needle) return true;
    return `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(needle);
  });
});

function canManage(user) {
  return isAdmin.value || user.role !== 'ADMINISTRADOR';
}

function roleOptionsFor(user) {
  if (isAdmin.value && canManage(user)) return ROLE_OPTIONS;
  return ROLE_OPTIONS.filter((role) => role !== 'ADMINISTRADOR');
}

async function loadUsers() {
  usersErr.value = '';
  usersLoading.value = true;
  try {
    const { data } = await api.get('/users');
    users.value = data.users || [];
  } catch (e) {
    usersErr.value = e.response?.data?.error || 'Falha ao carregar usuários.';
  } finally {
    usersLoading.value = false;
  }
}

async function changeRole(user, event) {
  const nextRole = event.target.value;
  if (nextRole === user.role) return;
  if (!window.confirm(`Alterar o papel de ${user.name} para ${roleLabel(nextRole)}?`)) {
    event.target.value = user.role;
    return;
  }
  userBusy.value = user.id;
  usersErr.value = '';
  try {
    await api.patch(`/users/${user.id}/role`, { role: nextRole });
    user.role = nextRole;
    showFlash(`Papel de ${user.name} atualizado para ${roleLabel(nextRole)}.`);
  } catch (e) {
    event.target.value = user.role;
    usersErr.value = e.response?.data?.error || 'Falha ao alterar o papel.';
  } finally {
    userBusy.value = '';
  }
}

async function resendInvite(user) {
  if (!window.confirm(`Reenviar convite para ${user.email}? Uma nova senha temporária será gerada.`)) return;
  userBusy.value = user.id;
  usersErr.value = '';
  try {
    await api.post(`/users/${user.id}/resend-invite`);
    showFlash(`Convite reenviado para ${user.email}.`);
  } catch (e) {
    usersErr.value = e.response?.data?.error || 'Falha ao reenviar convite.';
  } finally {
    userBusy.value = '';
  }
}

// ——— Settings ———
const settings = ref(null);
const balance = ref(null);
const savingFinancial = ref(false);
const savingBalance = ref(false);
const financialErr = ref('');
const balanceErr = ref('');
const emailTesting = ref(false);
const emailMsg = ref('');

const financialForm = reactive({
  automaticApprovalLimitCents: 0,
  currentExchangeRate: 5,
  votingDurationHours: 24,
});

const balanceForm = reactive({
  referenceYear: new Date().getFullYear(),
  availableCents: 0,
  provisionedCents: 0,
  spentCents: 0,
});

function hydrateForms() {
  if (settings.value) {
    financialForm.automaticApprovalLimitCents = Number(settings.value.automaticApprovalLimitCents || 0);
    financialForm.currentExchangeRate = Number(settings.value.currentExchangeRate || 0);
    financialForm.votingDurationHours = Number(settings.value.votingDurationHours || 0);
  }
  if (balance.value) {
    balanceForm.referenceYear = Number(balance.value.referenceYear || new Date().getFullYear());
    balanceForm.availableCents = Number(balance.value.availableCents || 0);
    balanceForm.provisionedCents = Number(balance.value.provisionedCents || 0);
    balanceForm.spentCents = Number(balance.value.spentCents || 0);
  }
}

async function loadSettings() {
  pageErr.value = '';
  try {
    const { data } = await api.get('/settings');
    settings.value = data.settings;
    balance.value = data.balance;
    hydrateForms();
    if (isAdmin.value) loadTransactions();
  } catch (e) {
    pageErr.value = e.response?.data?.error || 'Falha ao carregar parâmetros.';
  }
}

async function saveFinancial() {
  financialErr.value = '';
  if (financialForm.automaticApprovalLimitCents < 0) {
    financialErr.value = 'O limite não pode ser negativo.';
    return;
  }
  if (!financialForm.currentExchangeRate || financialForm.currentExchangeRate <= 0) {
    financialErr.value = 'Informe uma taxa de câmbio maior que zero.';
    return;
  }
  if (!financialForm.votingDurationHours || financialForm.votingDurationHours < 1) {
    financialErr.value = 'A duração da votação deve ser de ao menos 1 hora.';
    return;
  }
  savingFinancial.value = true;
  try {
    await api.patch('/settings/financial', {
      automaticApprovalLimitCents: financialForm.automaticApprovalLimitCents,
      currentExchangeRate: financialForm.currentExchangeRate,
      votingDurationHours: financialForm.votingDurationHours,
    });
    showFlash('Parâmetros financeiros atualizados.');
    await loadSettings();
  } catch (e) {
    financialErr.value = e.response?.data?.error || 'Falha ao salvar parâmetros.';
  } finally {
    savingFinancial.value = false;
  }
}

async function saveBalance() {
  balanceErr.value = '';
  if (!balanceForm.referenceYear || balanceForm.referenceYear < 2000) {
    balanceErr.value = 'Informe um exercício válido.';
    return;
  }
  savingBalance.value = true;
  try {
    const { data } = await api.patch('/settings/balance', {
      referenceYear: balanceForm.referenceYear,
      availableCents: balanceForm.availableCents,
      provisionedCents: balanceForm.provisionedCents,
      spentCents: balanceForm.spentCents,
    });
    if (data.balance) {
      balance.value = data.balance;
      hydrateForms();
    }
    showFlash(`Saldo do exercício ${balanceForm.referenceYear} atualizado.`);
  } catch (e) {
    balanceErr.value = e.response?.data?.error || 'Falha ao salvar saldo.';
  } finally {
    savingBalance.value = false;
  }
}

async function testEmail() {
  emailMsg.value = '';
  emailTesting.value = true;
  try {
    const { data } = await api.post('/settings/email/test', { to: auth.user?.email });
    emailMsg.value = data.message || 'E-mail de teste enviado.';
  } catch (e) {
    emailMsg.value = e.response?.data?.error || 'Falha ao enviar e-mail de teste.';
  } finally {
    emailTesting.value = false;
  }
}

// ——— Transactions ———
const transactions = ref([]);
const txLoading = ref(false);
const txErr = ref('');

async function loadTransactions() {
  if (!isAdmin.value) return;
  txErr.value = '';
  txLoading.value = true;
  try {
    const { data } = await api.get('/settings/transactions');
    transactions.value = data.transactions || [];
  } catch (e) {
    txErr.value = e.response?.data?.error || 'Falha ao carregar lançamentos.';
  } finally {
    txLoading.value = false;
  }
}

// ——— Batch import ———
const file = ref(null);
const importResult = ref(null);
const importing = ref(false);
const importAction = ref('');
const importErr = ref('');

const importValid = computed(() => importResult.value?.valid || importResult.value?.created || []);
const importInvalid = computed(() => importResult.value?.invalid || importResult.value?.errors || []);

function pick(event) {
  file.value = event.target.files?.[0] || null;
  importResult.value = null;
  importErr.value = '';
}

async function sendImport(path) {
  if (!file.value) return;
  importErr.value = '';
  importing.value = true;
  importAction.value = path.includes('confirm') ? 'confirm' : 'preview';
  try {
    const formData = new FormData();
    formData.append('file', file.value);
    const { data } = await api.post(path, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    importResult.value = data;
    if (importAction.value === 'confirm') {
      showFlash('Importação concluída.');
      await loadUsers();
    }
  } catch (e) {
    importErr.value = e.response?.data?.error || 'Falha na importação.';
  } finally {
    importing.value = false;
    importAction.value = '';
  }
}

const preview = () => sendImport('/users/batch/preview');
const confirmImport = () => {
  if (!file.value) return;
  if (window.confirm('Confirmar a criação dos usuários em lote?')) sendImport('/users/batch/confirm');
};

async function refreshAll() {
  refreshing.value = true;
  await Promise.allSettled([loadUsers(), loadSettings()]);
  refreshing.value = false;
}

onMounted(() => {
  loadUsers();
  loadSettings();
});
</script>
