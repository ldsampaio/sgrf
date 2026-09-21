<template>
  <div class="field">
    <label v-if="label">{{ label }}</label>
    <input class="input" :value="display" @input="onInput" :placeholder="placeholder" :disabled="disabled" inputmode="decimal" />
    <div class="hint" v-if="hint">{{ hint }}</div>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue';
import { formatCentsInput, parseBRLToCents } from '../utils/masks';
const props = defineProps({ modelValue: { type: Number, default: 0 }, label: String, hint: String, placeholder: String, disabled: Boolean });
const emit = defineEmits(['update:modelValue']);
const display = ref(formatCentsInput(props.modelValue));
watch(() => props.modelValue, (v) => { display.value = formatCentsInput(v); });
function onInput(e) {
  // máscara progressiva: só dígitos -> centavos
  const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
  const cents = digits ? parseInt(digits, 10) : 0;
  emit('update:modelValue', cents);
  display.value = formatCentsInput(cents);
}
</script>
