<template>
  <p class="eyebrow">Votação auditável · horário de Brasília</p>
  <h1 style="margin-top:0">Conselho — Votação</h1>
  <div class="alert error" v-if="err" role="alert">{{ err }}</div>
  <div class="card">
    <table class="table"><thead><tr><th>Pedido</th><th>Status</th><th>Prazo (Brasília)</th><th></th></tr></thead>
    <tbody><tr v-for="r in list" :key="r.id">
      <td><b>{{ r.title }}</b></td><td><StatusBadge :status="r.status" /></td><td>{{ isoToBR(r.votingDeadlineAt) }}</td>
      <td><button class="btn ghost" @click="sel = r.id">Abrir</button></td>
    </tr></tbody></table>
  </div>
  <div v-if="detail" class="card accent" style="margin-top:1rem">
    <h2 style="margin-top:0">{{ detail.title }} <StatusBadge :status="detail.status" /></h2>
    <div class="alert warn" v-if="suspended">Suspenso pelo chefe — somente leitura até liberação.</div>
    <h3>Votos</h3>
    <ul><li v-for="v in votes" :key="v.id"><b>{{ v.voterName || '—' }}</b> ({{ v.voterRole || '' }}) — <b>{{ v.voteType }}</b> — {{ v.comment }} <span class="hint">{{ isoToBR(v.createdAt) }}</span></li></ul>
    <div v-if="!suspended" class="grid cols-3">
      <div class="field"><label>Voto</label>
        <select class="input" v-model="vote.voteType"><option>DEFERIR</option><option>INDEFERIR</option><option>DEFERIR_PARCIALMENTE</option><option>ABSTER_SE</option></select>
      </div>
      <div class="field"><label>Comentário (obrigatório no parcial)</label><input class="input" v-model="vote.comment" /></div>
      <div class="field"><label>Valor parcial (R$)</label><MoneyInput v-model="voteCents" /></div>
    </div>
    <div v-if="!suspended">
      <button class="btn" @click="sendVote">Votar (auditável)</button>
      <div class="field"><label>Vista — justificativa (máx 1 por conselheiro)</label><input class="input" v-model="vista" /></div>
      <button class="btn ghost" @click="sendVista">Pedir vista +24h</button>
      <div class="field"><label>Discussão</label><input class="input" v-model="msg" /></div>
      <button class="btn ghost" @click="sendMsg">Enviar mensagem</button>
    </div>
    <div v-if="isChefe" class="card" style="margin-top:1rem">
      <h3>Chefe de departamento</h3>
      <div class="field"><label>Justificativa suspensão</label><input class="input" v-model="susp.justification" /></div>
      <button class="btn dark" @click="suspend">Suspender p/ reunião ordinária</button>
      <button class="btn ghost" @click="unsuspend">Liberar suspensão</button>
      <div class="field"><label>Ata da reunião</label><textarea class="input" v-model="col.ataText" rows="2" /></div>
      <div class="field"><label>Resultado colegiado</label>
        <select class="input" v-model="col.result"><option>DEFERIDO</option><option>INDEFERIDO</option><option>PARCIAL</option></select>
      </div>
      <MoneyInput v-model="colCents" label="Valor aprovado (R$)" />
      <button class="btn" @click="decide">Inserir decisão colegiada</button>
      <button class="btn ghost" @click="spent">Marcar gasto</button>
    </div>
    <h3>Mensagens</h3>
    <ul>
      <li v-for="m in messages" :key="m.id">
        <b>{{ m.authorName || '—' }}</b> <span class="hint">({{ m.authorRole || '' }}) — {{ isoToBR(m.createdAt) }}</span>
        <span v-if="m.edited" class="badge muted">editado</span>
        <div>{{ m.content }}</div>
      </li>
    </ul>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';
import StatusBadge from '../components/StatusBadge.vue';
import MoneyInput from '../components/MoneyInput.vue';
import { isoToBR } from '../utils/masks';
const auth = useAuth();
const list = ref([]); const sel = ref(null); const detail = ref(null);
const votes = ref([]); const messages = ref([]);
const err = ref(''); const vote = ref({ voteType: 'DEFERIR', comment: '' });
const voteCents = ref(0); const colCents = ref(0);
const vista = ref(''); const msg = ref('');
const susp = ref({ justification: '' }); const col = ref({ result: 'DEFERIDO', ataText: '' });
const isChefe = computed(() => auth.user?.role === 'CHEFE_DEPARTAMENTO');
const suspended = computed(() => detail.value?.status === 'SUSPENSO_REUNIAO_ORDINARIA');
async function load() { const { data } = await api.get('/requests?status=EM_VOTACAO'); list.value = data.requests; }
async function open() {
  if (!sel.value) return;
  const { data } = await api.get(`/requests/${sel.value}`); detail.value = data.request;
  votes.value = (await api.get(`/requests/${sel.value}/votes`)).data.votes;
  messages.value = (await api.get(`/requests/${sel.value}/messages`)).data.messages;
}
async function sendVote() { err.value = ''; try { if (!confirm('Confirmar voto? É auditável.')) return; await api.post(`/requests/${sel.value}/votes`, { ...vote.value, approvedAmountCents: voteCents.value }); await open(); } catch (e) { err.value = e.response?.data?.error; } }
async function sendVista() { err.value = ''; try { await api.post(`/requests/${sel.value}/view-requests`, { justification: vista.value }); await open(); } catch (e) { err.value = e.response?.data?.error; } }
async function sendMsg() { err.value = ''; try { await api.post(`/requests/${sel.value}/messages`, { content: msg.value }); msg.value = ''; await open(); } catch (e) { err.value = e.response?.data?.error; } }
async function suspend() { await api.post(`/requests/${sel.value}/suspend`, susp.value); await load(); await open(); }
async function unsuspend() { await api.post(`/requests/${sel.value}/unsuspend`); await load(); await open(); }
async function decide() { await api.post(`/requests/${sel.value}/colegiada-decision`, { result: col.value.result, ataText: col.value.ataText, approvedAmountCents: colCents.value }); await open(); }
async function spent() { if (!confirm('Marcar como gasto?')) return; await api.post(`/requests/${sel.value}/mark-spent`); await open(); }
watch(sel, open);
onMounted(load);
</script>
