<template>
  <div class="chart">
    <div v-if="total === 0" class="empty" style="padding: var(--space-7) var(--space-4)">
      <div class="empty__icon"><Icon name="chart" :size="22" /></div>
      <p class="empty__title">Sem dados para exibir</p>
      <p class="empty__text">Os valores aparecem aqui assim que houver movimentação no período.</p>
    </div>

    <template v-else>
      <div class="chart-card__canvas">
        <canvas ref="cv" role="img" :aria-label="ariaLabel"></canvas>
        <div class="donut-center" aria-hidden="true">
          <span>Total</span>
          <strong>{{ formatBRL(total) }}</strong>
        </div>
      </div>

      <ul class="chart-legend" aria-label="Legenda do gráfico">
        <li v-for="(label, i) in labels" :key="`${label}-${i}`" class="chart-legend__item">
          <span class="chart-legend__dot" :style="{ background: colorAt(i) }" aria-hidden="true"></span>
          <span class="chart-legend__name" :title="label">{{ label }}</span>
          <span class="chart-legend__value">{{ formatBRL(values[i]) }}</span>
          <span class="chart-legend__pct">{{ pct(i) }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js';
import Icon from './Icon.vue';
import { formatBRL } from '../utils/masks';

Chart.register(DoughnutController, ArcElement, Tooltip);

const props = defineProps({
  labels: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
});
const emit = defineEmits(['ready']);

const cv = ref(null);
let chart = null;

// Tiles pastel vibrantes + tints indigo — a paleta clay do projeto (MASTER.md §1.1).
// Exceção registrada: cores de gráfico ficam em constantes JS (Chart.js não lê CSS vars).
const PALETTE = [
  '#BFDBFE', // sky
  '#FDE68A', // amber
  '#C4B5FD', // lilac
  '#A7E8C3', // mint
  '#C7D2FE', // indigo tint
  '#FED7AA', // orange tint
  '#E7E5E4', // stone
  '#93C5FD', // sky deep
  '#DDD6FE', // lilac deep
  '#86EFAC', // mint deep
];

const total = computed(() => props.values.reduce((sum, value) => sum + Number(value || 0), 0));
const colorAt = (index) => PALETTE[index % PALETTE.length];

const ariaLabel = computed(() => {
  const parts = props.labels.map((label, i) => `${label}: ${formatBRL(props.values[i])} (${pct(i)})`);
  return `Gráfico de composição. Total ${formatBRL(total.value)}. ${parts.join('; ')}.`;
});

function pct(index) {
  if (!total.value) return '0%';
  return `${((Number(props.values[index] || 0) / total.value) * 100).toFixed(1)}%`;
}

function render() {
  if (chart) { chart.destroy(); chart = null; }
  if (!cv.value || total.value === 0) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  chart = new Chart(cv.value, {
    type: 'doughnut',
    data: {
      labels: props.labels,
      datasets: [{
        data: props.values.map((value) => Number(value || 0)),
        backgroundColor: props.labels.map((_, i) => colorAt(i)),
        borderColor: '#1B1B2F',
        borderWidth: 3,
        hoverOffset: 6,
        spacing: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: '66%',
      animation: { duration: reduceMotion ? 0 : 520 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#FFFFFF',
          borderColor: '#1B1B2F',
          borderWidth: 2,
          titleColor: '#1B1B2F',
          bodyColor: '#5B6270',
          padding: 12,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => ` ${formatBRL(ctx.raw)} · ${pct(ctx.dataIndex)}`,
          },
        },
      },
    },
  });

  emit('ready', () => chart?.toBase64Image() || null);
}

// Compose the chart over the brand canvas so PDF exports (white pages) stay readable.
function toImage() {
  if (!chart?.canvas) return null;
  const source = chart.canvas;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out.toDataURL('image/png');
}

onMounted(() => nextTick(render));
watch(
  () => [props.labels, props.values],
  () => nextTick(render),
  { deep: true },
);
onBeforeUnmount(() => chart?.destroy());

defineExpose({ toImage });
</script>
