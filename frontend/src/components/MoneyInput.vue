<template>
  <div class="field">
    <label v-if="label" class="field__label" :for="inputId">{{ label }}</label>
    <div class="input-wrap">
      <span class="input-wrap__prefix" aria-hidden="true">R$</span>
      <input
        :id="inputId"
        class="input"
        :value="display"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-describedby="hint ? hintId : undefined"
        inputmode="decimal"
        autocomplete="off"
        @input="onInput"
        @blur="onBlur"
      />
    </div>
    <div v-if="hint" :id="hintId" class="field__hint">{{ hint }}</div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue';
import { formatCentsInput } from '../utils/masks';

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  placeholder: { type: String, default: '0,00' },
  disabled: { type: Boolean, default: false },
  min: { type: Number, default: null },
  max: { type: Number, default: null },
});
const emit = defineEmits(['update:modelValue']);

const uid = useId();
const inputId = computed(() => `money-${uid}`);
const hintId = computed(() => `money-hint-${uid}`);
const display = ref(formatCentsInput(props.modelValue));

watch(
  () => props.modelValue,
  (value) => { display.value = formatCentsInput(value); },
);

function clamp(cents) {
  let next = cents;
  if (props.max != null && next > props.max) next = props.max;
  if (props.min != null && next < props.min) next = props.min;
  return next;
}

function onInput(event) {
  // Progressive BRL mask: digits become cents; the stored model stays integer.
  const digits = event.target.value.replace(/\D/g, '').slice(0, 12);
  const cents = clamp(digits ? parseInt(digits, 10) : 0);
  emit('update:modelValue', cents);
  display.value = formatCentsInput(cents);
}

function onBlur() {
  display.value = formatCentsInput(props.modelValue);
}
</script>
