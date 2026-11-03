<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="title ? 'img' : undefined"
    :aria-hidden="title ? undefined : 'true'"
    focusable="false"
  >
    <title v-if="title">{{ title }}</title>
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  strokeWidth: { type: [Number, String], default: 2 },
  title: { type: String, default: '' },
});

// Stroke-based icon set (24x24 grid, Lucide-style), one family for the whole app.
const ICONS = {
  dashboard: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'],
  gavel: ['m14.5 12.5-8 8a2.12 2.12 0 0 1-3-3l8-8', 'm16 16 6-6', 'm8 8 6-6', 'm9 7 8 8', 'm21 11-8-8'],
  chart: ['M3 3v18h18', 'M7 16v-5', 'M12 16V8', 'M17 16v-9'],
  settings: [
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['m20 6-11 11-5-5'],
  'check-circle': ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'm8.5 12 2.5 2.5 4.5-5'],
  'alert-circle': ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v4', 'M12 16h.01'],
  'alert-triangle': ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  calendar: ['M5 5h14v16H5z', 'M8 3v4', 'M16 3v4', 'M5 10h14'],
  user: ['M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  users: ['M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M2 21a7 7 0 0 1 14 0', 'M17 4a3 3 0 0 1 0 6', 'M22 21a6 6 0 0 0-4-5.6'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm20 20-4-4'],
  filter: ['M3 5h18', 'M6 12h12', 'M10 19h4'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 21h16'],
  upload: ['M12 21V9', 'm7 14 5-5 5 5', 'M4 3h16'],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  ban: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'm5.6 5.6 12.8 12.8'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  'chevron-left': ['m15 6-6 6 6 6'],
  'arrow-right': ['M5 12h14', 'm13 6 6 6-6 6'],
  'arrow-up-right': ['M7 17 17 7', 'M7 7h10v10'],
  wallet: ['M21 12V7H5a2 2 0 0 1 0-4h14v4', 'M3 5v14a2 2 0 0 0 2 2h16v-5', 'M18 12a2 2 0 0 0 0 4h4v-4Z'],
  receipt: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M8 7h8', 'M8 11h6', 'M8 15h4'],
  'file-check': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'm9 15 2 2 4-4'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M3 3l18 18'],
  mail: ['M3 5h18v14H3z', 'm3 6 9 7 9-7'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M21 14v7H3V4h7'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  banknote: ['M2 6h20v12H2z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6 12h.01', 'M18 12h.01'],
  scale: ['M12 3v18', 'M5 7h14', 'M5 7 2 14h6L5 7z', 'M19 7l-3 7h6l-3-7z', 'M8 21h8'],
  vote: ['m9 12 2 2 4-4', 'M5 4h14v16H5z'],
  pause: ['M8 4v16', 'M16 4v16'],
  flag: ['M4 15v6', 'M4 15c8 0 8-6 16-6v6c-8 0-8 6-16 6'],
  package: ['M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z', 'm3.3 7 8.7 5 8.7-5', 'M12 22V12'],
  plane: ['M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-1 1.6l5.6 3.6-3 3-2.2-.4a1 1 0 0 0-.9 1.6l2.4 2.4 2.4 2.4a1 1 0 0 0 1.6-.9l-.4-2.2 3-3 3.6 5.6a1 1 0 0 0 1.6-1z'],
  graduation: ['M22 10 12 5 2 10l10 5 10-5z', 'M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'],
};

const paths = computed(() => ICONS[props.name] || ICONS.info);
</script>
