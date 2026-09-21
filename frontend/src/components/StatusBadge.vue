<template>
  <span class="badge" :class="cls">{{ status }}</span>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ status: String });
const cls = computed(() => {
  const s = props.status || '';
  if (s.startsWith('APROVADO') || s === 'CONCLUIDO') return 'ok';
  if (s === 'EM_VOTACAO' || s === 'AGUARDANDO_DESEMPATE') return 'pending';
  if (s === 'SUSPENSO_REUNIAO_ORDINARIA') return 'dark';
  return 'muted';
});
</script>
