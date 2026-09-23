<template>
  <div class="topbar">
    <div class="topbar-inner">
      <router-link class="brand" to="/">SGRD <b>· UTFPR</b></router-link>
      <nav class="nav" v-if="auth.user">
        <router-link to="/">Dashboard</router-link>
        <router-link to="/requests">Solicitações</router-link>
        <router-link to="/council">Conselho</router-link>
        <router-link to="/reports">Relatórios</router-link>
        <router-link v-if="['ADMINISTRADOR','CHEFE_DEPARTAMENTO'].includes(auth.user.role)" to="/admin">Admin</router-link>
        <a href="#" class="logout" @click.prevent="logout">{{ auth.user.email }} · sair</a>
      </nav>
      <button v-if="auth.user" class="hamburger" @click="open = !open" aria-label="Abrir menu">☰</button>
    </div>
  </div>
  <div v-if="open && auth.user" class="mobile-menu open">
    <button class="close" @click="open = false" aria-label="Fechar menu">✕</button>
    <router-link to="/" @click="open = false">Dashboard</router-link>
    <router-link to="/requests" @click="open = false">Solicitações</router-link>
    <router-link to="/council" @click="open = false">Conselho</router-link>
    <router-link to="/reports" @click="open = false">Relatórios</router-link>
    <router-link v-if="['ADMINISTRADOR','CHEFE_DEPARTAMENTO'].includes(auth.user.role)" to="/admin" @click="open = false">Admin</router-link>
    <a href="#" @click.prevent="logout">{{ auth.user.email }} · sair</a>
  </div>
  <main class="page"><slot /></main>
  <footer class="footer">
    <div class="lockup">SGRD <b>· UTFPR</b></div>
    <nav>
      <router-link to="/">Dashboard</router-link>
      <router-link to="/requests">Solicitações</router-link>
      <router-link to="/council">Conselho</router-link>
      <router-link to="/reports">Relatórios</router-link>
    </nav>
    <div class="fineprint">Sistema de Gestão de Recursos Departamentais — uso institucional @utfpr.edu.br · horário de Brasília</div>
    <div class="weave" aria-hidden="true"></div>
  </footer>
</template>
<script setup>
import { ref } from 'vue';
import { useAuth } from '../stores/auth';
import { useRouter } from 'vue-router';
const auth = useAuth();
const router = useRouter();
const open = ref(false);
async function logout() { open.value = false; await auth.logout(); router.push('/login'); }
</script>
