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
        <a href="#" @click.prevent="logout">{{ auth.user.email }} · sair</a>
      </nav>
    </div>
  </div>
  <main class="page"><slot /></main>
</template>
<script setup>
import { useAuth } from '../stores/auth';
import { useRouter } from 'vue-router';
const auth = useAuth();
const router = useRouter();
async function logout() { await auth.logout(); router.push('/login'); }
</script>
