<template>
  <div class="field">
    <label v-if="label">{{ label }}</label>
    <input class="input" :value="display" @input="onInput" placeholder="dd/mm/aaaa" inputmode="numeric" />
  </div>
</template>
<script setup>
import { ref, watch } from 'vue';
import { maskDateDigits } from '../utils/masks';
const props = defineProps({ modelValue: { type: String, default: '' }, label: String });
const emit = defineEmits(['update:modelValue']);
const display = ref(props.modelValue);
watch(() => props.modelValue, (v) => { display.value = v; });
function onInput(e) { display.value = maskDateDigits(e.target.value); emit('update:modelValue', display.value); }
</script>
