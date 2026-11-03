<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
        <div
          ref="dialog"
          class="modal"
          :class="sizeClass"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <div class="modal__head">
            <div>
              <h2 :id="titleId" class="modal__title">{{ title }}</h2>
              <p v-if="subtitle" class="modal__sub">{{ subtitle }}</p>
              <slot name="header" />
            </div>
            <button type="button" class="modal__close" aria-label="Fechar" @click="emit('close')">
              <Icon name="close" :size="18" />
            </button>
          </div>
          <div class="modal__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal__foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
});

const emit = defineEmits(['close']);
const dialog = ref(null);
const titleId = useId();
let lastFocused = null;

const sizeClass = computed(() => (props.size === 'sm' ? 'modal--sm' : props.size === 'lg' ? 'modal--lg' : ''));

function focusableElements() {
  if (!dialog.value) return [];
  return [...dialog.value.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null);
}

function cleanup() {
  document.body.classList.remove('is-locked');
  document.removeEventListener('keydown', onKeydown);
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const els = focusableElements();
  if (!els.length) {
    event.preventDefault();
    dialog.value?.focus();
    return;
  }
  const first = els[0];
  const last = els[els.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement;
      document.body.classList.add('is-locked');
      document.addEventListener('keydown', onKeydown);
      await nextTick();
      (focusableElements()[0] || dialog.value)?.focus();
    } else {
      cleanup();
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      lastFocused = null;
    }
  },
);

onBeforeUnmount(cleanup);
</script>
