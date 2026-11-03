<template>
  <PageHeader
    eyebrow="Votação auditável · horário de Brasília"
    title="Conselho"
    description="Acompanhe a fila de deliberação, registre seu voto e consulte mensagens e prazos com transparência total."
  />

  <div v-if="flash" class="alert alert--success" role="status" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="check-circle" :size="18" />
    <div class="alert__body">{{ flash }}</div>
  </div>

  <div v-if="err" class="alert alert--error" role="alert" style="margin-bottom: var(--space-5)">
    <Icon class="alert__icon" name="alert-circle" :size="18" />
    <div class="alert__body">{{ err }}</div>
  </div>

  <div class="grid grid--master">
    <aside class="master__list" aria-label="Pedidos em votação">
      <div class="row row--between" style="padding: 0 var(--space-1) var(--space-1)">
        <span class="eyebrow" style="margin: 0">Na fila</span>
        <span class="count-pill">{{ list.length }}</span>
      </div>

      <div v-if="loadingList" class="stack stack--tight">
        <div v-for="n in 3" :key="n" class="skeleton" style="height: 84px"></div>
      </div>

      <EmptyState
        v-else-if="!list.length"
        icon="gavel"
        title="Fila vazia"
        text="Não há solicitações em votação neste momento."
      />

      <template v-else>
        <button
          v-for="request in list"
          :key="request.id"
          type="button"
          class="voting-item"
          :class="{ 'is-active': sel === request.id }"
          :aria-pressed="sel === request.id"
          @click="sel = request.id"
        >
          <span class="voting-item__title">{{ request.title }}</span>
          <span class="voting-item__meta">
            <StatusBadge :status="request.status" />
            <span class="row" style="gap: 5px">
              <Icon name="clock" :size="13" />
              {{ deadlineShort(request.votingDeadlineAt) }}
            </span>
          </span>
        </button>
      </template>
    </aside>

    <section class="stack" aria-live="polite">
      <div v-if="opening" class="card">
        <div class="skeleton skeleton--title" style="margin-bottom: var(--space-4)"></div>
        <div class="skeleton skeleton--text" v-for="n in 5" :key="n" style="margin-bottom: var(--space-3)"></div>
      </div>

      <EmptyState
        v-else-if="!detail"
        icon="gavel"
        title="Selecione um pedido"
        text="Escolha um item da fila para ver votos, discussão e ações de deliberação."
      />

      <template v-else>
        <article class="card card--accent">
          <div class="card__head">
            <div style="min-width: 0">
              <p class="eyebrow" style="margin-bottom: var(--space-2)">Pedido em deliberação</p>
              <h2 class="card__title" style="font-size: var(--text-xl)">{{ detail.title }}</h2>
              <p class="card__sub">Registrado em {{ fmtDate(detail.createdAt) }} · prazo absoluto {{ isoToBR(detail.votingDeadlineAt) }}</p>
            </div>
            <StatusBadge :status="detail.status" />
          </div>

          <div class="meta-grid">
            <div class="meta">
              <div class="meta__label">Tipo</div>
              <div class="meta__value">{{ typeLabel(detail.type) }}</div>
            </div>
            <div class="meta">
              <div class="meta__label">Solicitado</div>
              <div class="meta__value meta__value--accent">{{ formatBRL(detail.requestedAmountCents) }}</div>
            </div>
            <div class="meta">
              <div class="meta__label">Aprovado</div>
              <div class="meta__value">{{ formatBRL(detail.approvedAmountCents) }}</div>
            </div>
            <div class="meta">
              <div class="meta__label">Exercício</div>
              <div class="meta__value">{{ detail.referenceYear }}</div>
            </div>
            <div class="meta">
              <div class="meta__label">Prazo (Brasília)</div>
              <div class="meta__value">{{ isoToBR(detail.votingDeadlineAt) }}</div>
            </div>
          </div>

          <p v-if="detail.justification" class="small muted" style="margin-top: var(--space-5); margin-bottom: 0">
            {{ detail.justification }}
          </p>
        </article>

        <div v-if="suspended" class="alert alert--warning" role="alert">
          <Icon class="alert__icon" name="alert-triangle" :size="18" />
          <div class="alert__body">
            <span class="alert__title">Suspenso pela chefia</span>
            O pedido está em somente leitura até a reunião ordinária. Votos e mensagens ficam bloqueados.
          </div>
        </div>

        <div v-if="actionErr" class="alert alert--error" role="alert">
          <Icon class="alert__icon" name="alert-circle" :size="18" />
          <div class="alert__body">{{ actionErr }}</div>
        </div>

        <div class="grid grid--split">
          <article v-if="canVoteNow" class="card">
            <div class="card__head">
              <div>
                <h3 class="card__title">Seu voto</h3>
                <p class="card__sub">{{ myVote ? 'Você já votou; enviar novamente atualiza seu voto.' : 'Registre sua posição nesta deliberação.' }}</p>
              </div>
            </div>

            <div class="alert alert--info" role="note" style="margin-bottom: var(--space-4)">
              <Icon class="alert__icon" name="shield" :size="18" />
              <div class="alert__body">A votação é auditável: autor, papel e horário de Brasília ficam registrados.</div>
            </div>

            <form class="stack" @submit.prevent="sendVote">
              <fieldset class="fieldset">
                <legend class="field__label">Posição</legend>
                <div class="segmented" role="group" aria-label="Tipo de voto">
                  <button
                    v-for="option in VOTE_OPTIONS"
                    :key="option.value"
                    type="button"
                    class="segment"
                    :aria-pressed="vote.voteType === option.value"
                    @click="vote.voteType = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </fieldset>

              <div class="field">
                <label class="field__label" for="vote-comment">
                  Comentário
                  <span v-if="vote.voteType === 'DEFERIR_PARCIALMENTE'" class="required" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="vote-comment"
                  v-model="vote.comment"
                  class="textarea"
                  rows="3"
                  :placeholder="vote.voteType === 'DEFERIR_PARCIALMENTE' ? 'Obrigatório no voto parcial.' : 'Opcional, mas ajuda a compor a ata.'"
                ></textarea>
              </div>

              <MoneyInput
                v-if="vote.voteType === 'DEFERIR_PARCIALMENTE'"
                v-model="voteCents"
                label="Valor aprovado (R$)"
                hint="Obrigatório no voto parcial; deve ser maior que zero."
                :min="1"
                :max="detail.requestedAmountCents"
              />

              <button type="submit" class="btn" :disabled="busy === 'vote'">
                <span v-if="busy === 'vote'" class="spinner" aria-hidden="true"></span>
                <Icon v-else name="check" :size="18" />
                {{ busy === 'vote' ? 'Registrando…' : (myVote ? 'Atualizar voto (auditável)' : 'Votar (auditável)') }}
              </button>
            </form>
          </article>

          <article v-else-if="!suspended" class="card">
            <div class="card__head">
              <div>
                <h3 class="card__title">Votação</h3>
                <p class="card__sub">Restrições de participação.</p>
              </div>
            </div>
            <div class="alert alert--info" role="note">
              <Icon class="alert__icon" name="info" :size="18" />
              <div class="alert__body">{{ voteBlockedReason }}</div>
            </div>
          </article>

          <article class="card">
            <div class="card__head">
              <div>
                <h3 class="card__title">Votos registrados</h3>
                <p class="card__sub">{{ votes.length }} voto(s) nesta solicitação.</p>
              </div>
            </div>

            <EmptyState
              v-if="!votes.length"
              icon="vote"
              title="Nenhum voto ainda"
              text="Os votos aparecem aqui com autor, papel e horário."
            />

            <div v-else>
              <div v-for="item in votes" :key="item.id" class="vote-item">
                <span class="avatar avatar--sm" aria-hidden="true">{{ initials(item.voterName) }}</span>
                <div class="vote-item__body">
                  <div class="vote-item__head">
                    <span class="vote-item__name">{{ item.voterName || '—' }}</span>
                    <span class="badge" :class="`badge--${voteTone(item.voteType)}`">{{ voteLabel(item.voteType) }}</span>
                    <span v-if="item.voterRole" class="hint">{{ roleLabel(item.voterRole) }}</span>
                    <span class="vote-item__time">{{ isoToBR(item.createdAt) }}</span>
                  </div>
                  <p v-if="item.comment" class="vote-item__comment">{{ item.comment }}</p>
                  <p v-if="item.approvedAmountCents" class="small text-accent" style="margin: 4px 0 0">
                    Valor aprovado: <b>{{ formatBRL(item.approvedAmountCents) }}</b>
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>

        <article class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">Discussão</h3>
              <p class="card__sub">Mensagens do conselho, com autor, papel e horário de Brasília.</p>
            </div>
          </div>

          <EmptyState
            v-if="!messages.length"
            icon="message"
            title="Nenhuma mensagem ainda"
            text="Use a discussão para registrar argumentos antes do voto."
          />

          <div v-else>
            <div v-for="message in messages" :key="message.id" class="message-item">
              <span class="avatar avatar--sm" aria-hidden="true">{{ initials(message.authorName) }}</span>
              <div class="message-item__body">
                <div class="message-item__head">
                  <span class="message-item__name">{{ message.authorName || '—' }}</span>
                  <span class="hint">{{ roleLabel(message.authorRole) }}</span>
                  <span class="message-item__time">{{ isoToBR(message.createdAt) }}</span>
                  <span v-if="message.edited" class="badge badge--neutral">editado</span>
                </div>
                <div class="message-item__text" style="white-space: pre-wrap">{{ message.content }}</div>
              </div>
            </div>
          </div>

          <div v-if="canMessage" class="row" style="align-items: flex-start; margin-top: var(--space-4)">
            <label class="sr-only" for="discussion-message">Mensagem da discussão</label>
            <textarea
              id="discussion-message"
              v-model="msg"
              class="textarea"
              rows="2"
              placeholder="Escreva uma mensagem para o conselho…"
              style="flex: 1 1 240px"
            ></textarea>
            <button type="button" class="btn" :disabled="busy === 'message' || !msg.trim()" @click="sendMsg">
              <span v-if="busy === 'message'" class="spinner" aria-hidden="true"></span>
              <Icon v-else name="send" :size="17" />
              Enviar
            </button>
          </div>
          <p v-else-if="!suspended" class="hint" style="margin-top: var(--space-4)">
            Seu perfil pode acompanhar a discussão, mas não publicar mensagens.
          </p>
        </article>

        <article v-if="canVista" class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">Pedido de vista</h3>
              <p class="card__sub">Máximo de 1 por conselheiro; acrescenta 24 horas ao prazo.</p>
            </div>
          </div>
          <div class="row" style="align-items: flex-start">
            <label class="sr-only" for="vista-justification">Justificativa da vista</label>
            <input
              id="vista-justification"
              v-model="vista"
              class="input"
              placeholder="Justificativa da vista…"
              style="flex: 1 1 240px"
            />
            <button type="button" class="btn btn--secondary" :disabled="busy === 'vista' || !vista.trim()" @click="sendVista">
              <span v-if="busy === 'vista'" class="spinner" aria-hidden="true"></span>
              <Icon v-else name="clock" :size="17" />
              Pedir vista +24h
            </button>
          </div>
        </article>

        <article v-if="isChefe" class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">Decisões da chefia</h3>
              <p class="card__sub">Suspensão, decisão colegiada e execução financeira.</p>
            </div>
            <span class="badge badge--info">Chefia</span>
          </div>

          <div class="grid grid--2">
            <div class="stack">
              <h4>Suspensão para reunião ordinária</h4>
              <p class="hint">Enquanto suspensa, a solicitação fica em somente leitura.</p>
              <div class="field">
                <label class="field__label" for="suspend-justification">Justificativa</label>
                <input id="suspend-justification" v-model="susp.justification" class="input" placeholder="Motivo da suspensão…" />
              </div>
              <div class="row">
                <button type="button" class="btn btn--secondary btn--sm" :disabled="suspended || busy === 'suspend'" @click="suspend">
                  Suspender
                </button>
                <button type="button" class="btn btn--ghost btn--sm" :disabled="!suspended || busy === 'unsuspend'" @click="unsuspend">
                  Liberar suspensão
                </button>
              </div>
            </div>

            <div class="stack">
              <h4>Decisão colegiada</h4>
              <p class="hint">Disponível apenas enquanto a solicitação está suspensa.</p>
              <div class="field">
                <label class="field__label" for="ata-text">Ata da reunião <span class="required" aria-hidden="true">*</span></label>
                <textarea id="ata-text" v-model="col.ataText" class="textarea" rows="2" placeholder="Registro da deliberação…"></textarea>
              </div>
              <div class="field">
                <label class="field__label" for="collegiate-result">Resultado</label>
                <select id="collegiate-result" v-model="col.result" class="select">
                  <option value="DEFERIDO">Deferido</option>
                  <option value="INDEFERIDO">Indeferido</option>
                  <option value="PARCIAL">Parcial</option>
                </select>
              </div>
              <MoneyInput
                v-model="colCents"
                label="Valor aprovado (R$)"
                hint="Obrigatório no resultado parcial."
                :max="detail.requestedAmountCents"
              />
              <button type="button" class="btn" :disabled="!suspended || busy === 'decide'" @click="decide">
                <span v-if="busy === 'decide'" class="spinner" aria-hidden="true"></span>
                <Icon v-else name="file-check" :size="17" />
                Inserir decisão colegiada
              </button>
            </div>
          </div>

          <hr class="divider" />

          <div class="row row--between">
            <p class="hint" style="margin: 0">Marcar como gasto encerra a execução financeira do pedido aprovado.</p>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              :disabled="!canMarkSpent || busy === 'spent'"
              @click="spent"
            >
              <span v-if="busy === 'spent'" class="spinner" aria-hidden="true"></span>
              <Icon v-else name="check-circle" :size="16" />
              Marcar como gasto
            </button>
          </div>
        </article>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import StatusBadge from '../components/StatusBadge.vue';
import MoneyInput from '../components/MoneyInput.vue';
import EmptyState from '../components/EmptyState.vue';
import Icon from '../components/Icon.vue';
import { formatBRL, isoToBR } from '../utils/masks';
import { initials, roleLabel, typeLabel, voteLabel, voteTone } from '../utils/labels';

const auth = useAuth();

const VOTE_OPTIONS = [
  { value: 'DEFERIR', label: 'Deferir' },
  { value: 'INDEFERIR', label: 'Indeferir' },
  { value: 'DEFERIR_PARCIALMENTE', label: 'Parcial' },
  { value: 'ABSTER_SE', label: 'Abster-se' },
];

const list = ref([]);
const sel = ref(null);
const detail = ref(null);
const votes = ref([]);
const messages = ref([]);

const loadingList = ref(true);
const opening = ref(false);
const busy = ref('');
const err = ref('');
const actionErr = ref('');
const flash = ref('');

const vote = ref({ voteType: 'DEFERIR', comment: '' });
const voteCents = ref(0);
const vista = ref('');
const msg = ref('');
const susp = ref({ justification: '' });
const col = ref({ result: 'DEFERIDO', ataText: '' });
const colCents = ref(0);

let flashTimer = null;

const isChefe = computed(() => auth.user?.role === 'CHEFE_DEPARTAMENTO');
const suspended = computed(() => detail.value?.status === 'SUSPENSO_REUNIAO_ORDINARIA');
const isVotingOpen = computed(() => detail.value && ['EM_VOTACAO', 'AGUARDANDO_DESEMPATE'].includes(detail.value.status));
const isOwner = computed(() => detail.value && String(detail.value.requesterId) === String(auth.user?.id));
const hasEligibleRole = computed(() => ['CHEFE_DEPARTAMENTO', 'CONSELHEIRO'].includes(auth.user?.role));
const isTieBreak = computed(() => detail.value?.status === 'AGUARDANDO_DESEMPATE');

const canVoteNow = computed(() => Boolean(
  detail.value
  && !suspended.value
  && isVotingOpen.value
  && hasEligibleRole.value
  && !isOwner.value
  && (!isTieBreak.value || isChefe.value),
));

const myVote = computed(() => votes.value.find((item) => String(item.voterId) === String(auth.user?.id)));

const voteBlockedReason = computed(() => {
  if (!detail.value) return '';
  if (suspended.value) return 'Solicitação suspensa: somente leitura até a liberação da chefia.';
  if (!isVotingOpen.value) return 'A votação não está aberta para este pedido.';
  if (!hasEligibleRole.value) return 'Seu perfil pode acompanhar a votação, mas o voto é restrito a conselheiros e à chefia.';
  if (isOwner.value) return 'O solicitante não vota na própria solicitação.';
  if (isTieBreak.value) return 'Empate: aguardando o voto de desempate da chefia.';
  return 'Você não pode votar neste momento.';
});

const canMessage = computed(() => Boolean(
  detail.value
  && !suspended.value
  && ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR'].includes(auth.user?.role),
));

const canVista = computed(() => Boolean(
  detail.value
  && !suspended.value
  && detail.value.status === 'EM_VOTACAO'
  && ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR'].includes(auth.user?.role),
));

const canMarkSpent = computed(() => ['APROVADO', 'APROVADO_PARCIALMENTE', 'APROVADO_AUTOMATICAMENTE'].includes(detail.value?.status));

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const deadlineShort = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function showFlash(message) {
  flash.value = message;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash.value = ''; }, 6000);
}

async function load() {
  err.value = '';
  loadingList.value = true;
  try {
    const { data } = await api.get('/requests?status=EM_VOTACAO');
    list.value = data.requests || [];
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha ao carregar a fila de votação.';
  } finally {
    loadingList.value = false;
  }
}

async function open() {
  if (!sel.value) return;
  actionErr.value = '';
  opening.value = true;
  detail.value = null;
  votes.value = [];
  messages.value = [];
  try {
    const { data } = await api.get(`/requests/${sel.value}`);
    detail.value = data.request;

    const votesResponse = await api.get(`/requests/${sel.value}/votes`);
    votes.value = votesResponse.data.votes || [];

    const messagesResponse = await api.get(`/requests/${sel.value}/messages`);
    messages.value = messagesResponse.data.messages || [];

    if (myVote.value) {
      vote.value = {
        voteType: myVote.value.voteType,
        comment: myVote.value.comment || '',
      };
      voteCents.value = myVote.value.approvedAmountCents || 0;
    } else {
      vote.value = { voteType: 'DEFERIR', comment: '' };
      voteCents.value = 0;
    }
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao abrir o pedido.';
  } finally {
    opening.value = false;
  }
}

async function refreshDetail() {
  await open();
}

async function sendVote() {
  actionErr.value = '';
  if (vote.value.voteType === 'DEFERIR_PARCIALMENTE') {
    if (!vote.value.comment.trim()) {
      actionErr.value = 'O voto parcial exige comentário.';
      return;
    }
    if (!voteCents.value || voteCents.value <= 0) {
      actionErr.value = 'O voto parcial exige um valor aprovado maior que zero.';
      return;
    }
  }
  const confirmed = window.confirm('Confirmar voto? A votação é auditável e registra autor, papel e horário.');
  if (!confirmed) return;

  busy.value = 'vote';
  try {
    const payload = {
      voteType: vote.value.voteType,
      comment: vote.value.comment.trim(),
      approvedAmountCents: voteCents.value,
    };
    if (myVote.value) {
      await api.put(`/requests/${sel.value}/votes/me`, payload);
      showFlash('Voto atualizado com registro de auditoria.');
    } else {
      await api.post(`/requests/${sel.value}/votes`, payload);
      showFlash('Voto registrado com sucesso.');
    }
    await refreshDetail();
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao registrar o voto.';
  } finally {
    busy.value = '';
  }
}

async function sendVista() {
  actionErr.value = '';
  if (!vista.value.trim()) {
    actionErr.value = 'Informe a justificativa para o pedido de vista.';
    return;
  }
  busy.value = 'vista';
  try {
    await api.post(`/requests/${sel.value}/view-requests`, { justification: vista.value.trim() });
    vista.value = '';
    showFlash('Vista registrada. O prazo foi estendido em 24 horas.');
    await refreshDetail();
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao pedir vista.';
  } finally {
    busy.value = '';
  }
}

async function sendMsg() {
  actionErr.value = '';
  if (!msg.value.trim()) return;
  busy.value = 'message';
  try {
    await api.post(`/requests/${sel.value}/messages`, { content: msg.value.trim() });
    msg.value = '';
    showFlash('Mensagem publicada na discussão.');
    await refreshDetail();
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao enviar a mensagem.';
  } finally {
    busy.value = '';
  }
}

async function suspend() {
  actionErr.value = '';
  if (!susp.value.justification.trim()) {
    actionErr.value = 'Informe a justificativa da suspensão.';
    return;
  }
  busy.value = 'suspend';
  try {
    await api.post(`/requests/${sel.value}/suspend`, { justification: susp.value.justification.trim() });
    susp.value.justification = '';
    await load();
    await refreshDetail();
    showFlash('Solicitação suspensa para reunião ordinária.');
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao suspender.';
  } finally {
    busy.value = '';
  }
}

async function unsuspend() {
  actionErr.value = '';
  busy.value = 'unsuspend';
  try {
    await api.post(`/requests/${sel.value}/unsuspend`);
    await load();
    await refreshDetail();
    showFlash('Suspensão liberada. A votação foi retomada.');
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao liberar a suspensão.';
  } finally {
    busy.value = '';
  }
}

async function decide() {
  actionErr.value = '';
  if (!col.value.ataText.trim()) {
    actionErr.value = 'A ata da reunião é obrigatória.';
    return;
  }
  if (col.value.result === 'PARCIAL' && (!colCents.value || colCents.value <= 0)) {
    actionErr.value = 'Informe o valor aprovado para o resultado parcial.';
    return;
  }
  busy.value = 'decide';
  try {
    await api.post(`/requests/${sel.value}/colegiada-decision`, {
      result: col.value.result,
      ataText: col.value.ataText.trim(),
      approvedAmountCents: colCents.value,
    });
    col.value.ataText = '';
    await load();
    await refreshDetail();
    showFlash('Decisão colegiada registrada.');
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao registrar a decisão.';
  } finally {
    busy.value = '';
  }
}

async function spent() {
  actionErr.value = '';
  const confirmed = window.confirm('Marcar esta solicitação como gasta? A ação é auditável.');
  if (!confirmed) return;
  busy.value = 'spent';
  try {
    await api.post(`/requests/${sel.value}/mark-spent`);
    await refreshDetail();
    showFlash('Solicitação marcada como gasta.');
  } catch (e) {
    actionErr.value = e.response?.data?.error || 'Falha ao marcar como gasto.';
  } finally {
    busy.value = '';
  }
}

watch(sel, open);
onMounted(load);
</script>
