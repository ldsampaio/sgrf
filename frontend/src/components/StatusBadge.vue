<template>
  <span class="badge" :class="`badge--${tone}`" :title="raw">
    <Icon class="badge__icon" :name="iconName" :size="14" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({ status: { type: String, default: '' } });

// Status = cor + ícone + rótulo (nunca só cor — MASTER.md §1.2).
const MAP = {
  RASCUNHO: { label: 'Rascunho', tone: 'neutral', icon: 'pencil' },
  EM_VOTACAO: { label: 'Em votação', tone: 'warning', icon: 'vote' },
  AGUARDANDO_DESEMPATE: { label: 'Aguardando desempate', tone: 'warning', icon: 'scale' },
  SUSPENSO_REUNIAO_ORDINARIA: { label: 'Suspenso', tone: 'info', icon: 'pause' },
  APROVADO_AUTOMATICAMENTE: { label: 'Aprovado autom.', tone: 'success', icon: 'check-circle' },
  APROVADO: { label: 'Aprovado', tone: 'success', icon: 'check-circle' },
  APROVADO_PARCIALMENTE: { label: 'Aprovado parcial', tone: 'success', icon: 'check-circle' },
  CONCLUIDO: { label: 'Concluído', tone: 'success', icon: 'check' },
  INDEFERIDO: { label: 'Indeferido', tone: 'danger', icon: 'ban' },
  CANCELADO: { label: 'Cancelado', tone: 'danger', icon: 'close' },
};

const raw = computed(() => props.status || '—');
const entry = computed(() => MAP[props.status] || { label: props.status || '—', tone: 'neutral', icon: 'info' });
const label = computed(() => entry.value.label);
const tone = computed(() => entry.value.tone);
const iconName = computed(() => entry.value.icon);
</script>
