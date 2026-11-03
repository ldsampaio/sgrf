<template>
  <div class="field">
    <label v-if="label" class="field__label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      class="input"
      :value="display"
      placeholder="dd/mm/aaaa"
      inputmode="numeric"
      autocomplete="off"
      :aria-describedby="hint ? hintId : undefined"
      @input="onInput"
    />
    <div v-if="hint" :id="hintId" class="field__hint">{{ hint }}</div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue';
import { maskDateDigits } from '../utils/masks';

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const uid = useId();
const inputId = computed(() => `date-${uid}`);
const hintId = computed(() => `date-hint-${uid}`);
const display = ref(props.modelValue);

watch(
  () => props.modelValue,
  (value) => { display.value = value; },
);

function onInput(event) {
  display.value = maskDateDigits(event.target.value);
  emit('update:modelValue', display.value);
}
</script>
