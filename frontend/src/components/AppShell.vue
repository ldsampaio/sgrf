<template>
  <a class="skip-link" href="#main">Pular para o conteúdo</a>

  <main v-if="bare" id="main" class="app-main">
    <slot />
  </main>

  <template v-else>
    <header class="topbar">
      <div class="topbar__inner">
        <router-link to="/" class="brand" aria-label="SGRD UTFPR — início">
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

        <nav v-if="auth.user" class="nav" aria-label="Navegação principal">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav__link"
          >
            <Icon :name="item.icon" :size="18" />
            <span>{{ item.label }}</span>
          </router-link>
        </nav>

        <div class="topbar__actions">
          <template v-if="auth.user">
            <div ref="userRef" class="user">
              <button
                type="button"
                class="user__button"
                :aria-expanded="menuOpen"
                aria-haspopup="true"
                :aria-controls="menuOpen ? 'user-menu' : undefined"
                @click="menuOpen = !menuOpen"
              >
                <span class="avatar" aria-hidden="true">{{ initials }}</span>
                <span class="user__meta">
                  <span class="user__name">{{ auth.user.name || 'Conta' }}</span>
                  <span class="user__role">{{ roleLabel(auth.user.role) }}</span>
                </span>
                <Icon class="user__chevron" name="chevron-down" :size="16" />
              </button>

              <div v-if="menuOpen" id="user-menu" class="dropdown" role="menu">
                <div class="dropdown__head">
                  <div class="dropdown__name">{{ auth.user.name || 'Conta institucional' }}</div>
                  <div class="dropdown__email">{{ auth.user.email }}</div>
                </div>
                <router-link to="/change-password" class="dropdown__item" role="menuitem" @click="menuOpen = false">
                  <Icon name="lock" :size="17" />
                  Alterar senha
                </router-link>
                <div class="dropdown__sep" role="separator"></div>
                <button type="button" class="dropdown__item dropdown__item--danger" role="menuitem" @click="logout">
                  <Icon name="logout" :size="17" />
                  Sair da conta
                </button>
              </div>
            </div>

            <button
              type="button"
              class="hamburger icon-btn"
              aria-label="Abrir menu"
              :aria-expanded="mobileOpen"
              aria-controls="mobile-nav"
              @click="mobileOpen = true"
            >
              <Icon name="menu" :size="20" />
            </button>
          </template>

          <router-link v-else to="/login" class="btn btn--sm">Entrar</router-link>
        </div>
      </div>
    </header>

    <main id="main" class="app-main">
      <slot />
    </main>

    <footer class="footer">
      <div class="footer__inner">
        <div>
          <div class="footer__brand">
            <span class="avatar avatar--sm" aria-hidden="true">SG</span>
            SGRD · UTFPR
          </div>
          <p class="footer__meta">Sistema de Gestão de Recursos Departamentais · uso institucional @utfpr.edu.br · horário de Brasília</p>
        </div>
        <nav class="footer__links" aria-label="Links do rodapé">
          <router-link to="/">Dashboard</router-link>
          <router-link to="/requests">Solicitações</router-link>
          <router-link to="/council">Conselho</router-link>
          <router-link to="/reports">Relatórios</router-link>
        </nav>
      </div>
      <div class="weave" aria-hidden="true"></div>
    </footer>
  </template>

  <Teleport to="body">
    <Transition name="mobile-nav">
      <div v-if="mobileOpen && auth.user" id="mobile-nav" class="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu principal">
        <div class="mobile-nav__head">
          <span class="brand">
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
          </span>
          <button type="button" class="icon-btn" aria-label="Fechar menu" @click="mobileOpen = false">
            <Icon name="close" :size="20" />
          </button>
        </div>

        <nav class="mobile-nav__links" aria-label="Navegação principal">
          <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="mobile-nav__link" @click="mobileOpen = false">
            <Icon :name="item.icon" :size="22" />
            {{ item.label }}
          </router-link>
          <router-link to="/change-password" class="mobile-nav__link" @click="mobileOpen = false">
            <Icon name="lock" :size="22" />
            Alterar senha
          </router-link>
        </nav>

        <div class="mobile-nav__user">
          <span class="avatar avatar--lg" aria-hidden="true">{{ initials }}</span>
          <div class="user__meta">
            <span class="user__name" style="color: var(--text)">{{ auth.user.name || 'Conta' }}</span>
            <span class="user__role" style="color: var(--text-faint)">{{ auth.user.email }}</span>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" style="margin-left: auto" @click="logout">
            Sair
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from './Icon.vue';
import { useAuth } from '../stores/auth';
import { initials as initialsOf, roleLabel } from '../utils/labels';

const auth = useAuth();
const router = useRouter();
const route = useRoute();

const menuOpen = ref(false);
const mobileOpen = ref(false);
const userRef = ref(null);

const bare = computed(() => Boolean(route.meta.bare));

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/requests', label: 'Solicitações', icon: 'file-text' },
  { to: '/council', label: 'Conselho', icon: 'gavel' },
  { to: '/reports', label: 'Relatórios', icon: 'chart' },
  { to: '/admin', label: 'Admin', icon: 'shield', roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] },
];

const navItems = computed(() =>
  NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(auth.user?.role)),
);

const initials = computed(() => initialsOf(auth.user?.name || auth.user?.email?.split('@')[0]));

function onDocumentClick(event) {
  if (!menuOpen.value) return;
  if (userRef.value && !userRef.value.contains(event.target)) menuOpen.value = false;
}

function onDocumentKeydown(event) {
  if (event.key !== 'Escape') return;
  menuOpen.value = false;
  mobileOpen.value = false;
}

watch(
  () => route.fullPath,
  () => { menuOpen.value = false; mobileOpen.value = false; },
);

watch(mobileOpen, (open) => {
  document.body.classList.toggle('is-locked', open);
});

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKeydown);
  document.body.classList.remove('is-locked');
});

async function logout() {
  menuOpen.value = false;
  mobileOpen.value = false;
  await auth.logout();
  router.push('/login');
}
</script>
