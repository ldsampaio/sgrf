<template>
  <span class="badge" :class="`badge--${tone}`" :title="raw">
    <span class="badge__dot" aria-hidden="true"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ status: { type: String, default: '' } });

const MAP = {
  RASCUNHO: { label: 'Rascunho', tone: 'neutral' },
  EM_VOTACAO: { label: 'Em votação', tone: 'warning' },
  AGUARDANDO_DESEMPATE: { label: 'Aguardando desempate', tone: 'warning' },
  SUSPENSO_REUNIAO_ORDINARIA: { label: 'Suspenso', tone: 'info' },
  APROVADO_AUTOMATICAMENTE: { label: 'Aprovado autom.', tone: 'success' },
  APROVADO: { label: 'Aprovado', tone: 'success' },
  APROVADO_PARCIALMENTE: { label: 'Aprovado parcial', tone: 'success' },
  CONCLUIDO: { label: 'Concluído', tone: 'success' },
  INDEFERIDO: { label: 'Indeferido', tone: 'danger' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
};

const raw = computed(() => props.status || '—');
const entry = computed(() => MAP[props.status] || { label: props.status || '—', tone: 'neutral' });
const label = computed(() => entry.value.label);
const tone = computed(() => entry.value.tone);
</script>
