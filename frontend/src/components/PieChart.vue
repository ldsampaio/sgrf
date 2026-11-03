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

// Amber ramp + neutrals: the only palette allowed by the brand.
const PALETTE = ['#FBBA00', '#DB8800', '#FFD466', '#F9F9F9', '#B3B3B3', '#9A7400', '#8C8C8C', '#5C5C5C', '#3A3A3A'];

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
        borderColor: '#171717',
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
          backgroundColor: '#0F0F0F',
          borderColor: '#2A2A2A',
          borderWidth: 1,
          titleColor: '#F9F9F9',
          bodyColor: '#B3B3B3',
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
  ctx.fillStyle = '#0F0F0F';
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
