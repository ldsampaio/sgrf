<template>
  <div>
    <div v-if="total === 0" class="hint" style="border:1px dashed var(--graphite);border-radius:16px;padding:1.5rem;text-align:center">
      Sem dados para exibir
    </div>
    <canvas v-else ref="cv"></canvas>
    <ul v-if="total > 0" class="hint" style="list-style:none;padding:0;margin:.5rem 0 0">
      <li v-for="(l, i) in labels" :key="l">
        <span :style="{ display: 'inline-block', width: '12px', height: '12px', background: colors[i % colors.length], marginRight: '6px' }"></span>
        {{ l }} — {{ formatBRL(values[i]) }} ({{ pct(i) }})
      </li>
    </ul>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';
import { formatBRL } from '../utils/masks';
Chart.register(PieController, ArcElement, Tooltip, Legend);

const props = defineProps({ labels: { type: Array, default: () => [] }, values: { type: Array, default: () => [] } });
const emit = defineEmits(['ready']);
const cv = ref(null);
let chart = null;
const colors = ['#FBBA00', '#DB8800', '#FFD466', '#F9F9F9', '#B3B3B3', '#2A2A2A', '#171717', '#8a6d00', '#5c5c5c'];
const total = computed(() => props.values.reduce((s, v) => s + Number(v || 0), 0));

function pct(i) {
  const t = props.values.reduce((s, v) => s + Number(v || 0), 0);
  if (!t) return '0%';
  return `${((Number(props.values[i] || 0) / t) * 100).toFixed(1)}%`;
}
function render() {
  if (chart) { chart.destroy(); chart = null; }
  if (total.value === 0 || !cv.value) return;
  chart = new Chart(cv.value, {
    type: 'pie',
    data: { labels: props.labels, datasets: [{ data: props.values, backgroundColor: props.labels.map((_, i) => colors[i % colors.length]) }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false, labels: { color: '#F9F9F9' } }, tooltip: { callbacks: { label: (c) => ` ${formatBRL(c.raw)} (${pct(c.dataIndex)})` } } },
    },
  });
  emit('ready', () => chart.toBase64Image());
}
onMounted(() => nextTick(render));
watch(() => [props.labels, props.values], () => nextTick(render), { deep: true });
onBeforeUnmount(() => chart?.destroy());
defineExpose({ toImage: () => chart?.toBase64Image() || null });
</script>
