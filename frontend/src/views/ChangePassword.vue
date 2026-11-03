<template>
  <div class="auth auth--centered">
    <section class="auth__panel">
      <div class="auth__card">
        <router-link to="/" class="brand auth__brand" aria-label="SGRD UTFPR — início">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
              <path d="M4.5 5 10 12l-5.5 7" />
              <path d="M12.5 5 18 12l-5.5 7" />
            </svg>
          </span>
          <span class="brand__text">
            <span class="brand__name">SGRD</span>
            <span class="brand__sub">UTFPR</span>
          </span>
        </router-link>

        <p class="eyebrow">Segurança da conta</p>
        <h1>{{ mustChange ? 'Defina uma nova senha' : 'Atualizar senha' }}</h1>
        <p class="auth__intro">
          {{ mustChange
            ? 'Sua senha temporária precisa ser trocada antes de continuar. Escolha uma nova senha com pelo menos 8 caracteres.'
            : 'Informe sua senha atual e escolha uma nova. Você continuará conectado após a troca.' }}
        </p>

        <div v-if="err" class="alert alert--error" role="alert" style="margin-bottom: var(--space-4)">
          <Icon class="alert__icon" name="alert-circle" :size="18" />
          <div class="alert__body">{{ err }}</div>
        </div>

        <div v-if="ok" class="alert alert--success" role="status" style="margin-bottom: var(--space-4)">
          <Icon class="alert__icon" name="check-circle" :size="18" />
          <div class="alert__body" style="color: var(--accent)">Senha alterada com sucesso — redirecionando…</div>
        </div>

        <form class="stack" @submit.prevent="submit">
          <div class="field">
            <label class="field__label" for="current-password">Senha atual</label>
            <div class="input-wrap input-wrap--suffix">
              <input
                id="current-password"
                v-model="currentPassword"
                class="input"
                :type="showCurrent ? 'text' : 'password'"
                placeholder="Sua senha atual"
                autocomplete="current-password"
                required
                autofocus
              />
              <button
                type="button"
                class="input-wrap__suffix"
                :aria-label="showCurrent ? 'Ocultar senha atual' : 'Mostrar senha atual'"
                :aria-pressed="showCurrent"
                @click="showCurrent = !showCurrent"
              >
                <Icon :name="showCurrent ? 'eye-off' : 'eye'" :size="18" />
              </button>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="new-password">Nova senha</label>
            <div class="input-wrap input-wrap--suffix">
              <input
                id="new-password"
                v-model="newPassword"
                class="input"
                :type="showNew ? 'text' : 'password'"
                placeholder="Mínimo de 8 caracteres"
                autocomplete="new-password"
                minlength="8"
                required
              />
              <button
                type="button"
                class="input-wrap__suffix"
                :aria-label="showNew ? 'Ocultar nova senha' : 'Mostrar nova senha'"
                :aria-pressed="showNew"
                @click="showNew = !showNew"
              >
                <Icon :name="showNew ? 'eye-off' : 'eye'" :size="18" />
              </button>
            </div>
            <span class="field__hint">Use letras, números e símbolos para uma senha mais forte.</span>
          </div>

          <div class="field">
            <label class="field__label" for="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              class="input"
              :type="showNew ? 'text' : 'password'"
              placeholder="Repita a nova senha"
              autocomplete="new-password"
              required
              :aria-invalid="confirmMismatch || undefined"
            />
            <span v-if="confirmMismatch" class="field__error" role="alert">As senhas não conferem.</span>
          </div>

          <div class="row" style="margin-top: var(--space-2)">
            <button type="submit" class="btn" :disabled="loading || confirmMismatch">
              <span v-if="loading" class="spinner" aria-hidden="true"></span>
              <Icon v-else name="lock" :size="18" />
              {{ loading ? 'Alterando…' : 'Salvar nova senha' }}
            </button>
            <button type="button" class="btn btn--ghost" :disabled="loading" @click="logout">
              <Icon name="logout" :size="17" />
              Sair
            </button>
          </div>
        </form>

        <p class="auth__foot">Se você não reconhece esta solicitação, procure a administração do departamento.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '../components/Icon.vue';
import { api } from '../services/api';
import { useAuth } from '../stores/auth';

const router = useRouter();
const auth = useAuth();
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrent = ref(false);
const showNew = ref(false);
const loading = ref(false);
const err = ref('');
const ok = ref(false);

const mustChange = computed(() => Boolean(auth.user?.mustChangePassword));
const confirmMismatch = computed(
  () => Boolean(confirmPassword.value) && confirmPassword.value !== newPassword.value,
);

async function submit() {
  err.value = '';
  if (newPassword.value.length < 8) {
    err.value = 'A nova senha precisa ter pelo menos 8 caracteres.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    err.value = 'As senhas não conferem.';
    return;
  }
  loading.value = true;
  try {
    await api.post('/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });
    ok.value = true;
    await auth.me();
    setTimeout(() => router.push('/'), 700);
  } catch (e) {
    err.value = e.response?.data?.error || 'Falha na troca de senha.';
  } finally {
    loading.value = false;
  }
}

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>
