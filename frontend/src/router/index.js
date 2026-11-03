import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth';
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import Requests from '../views/Requests.vue';
import Admin from '../views/Admin.vue';

import Council from '../views/Council.vue';
import Reports from '../views/Reports.vue';
import ChangePassword from '../views/ChangePassword.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login, meta: { bare: true, title: 'Entrar' } },
    { path: '/', component: Dashboard, meta: { auth: true, title: 'Dashboard' } },
    { path: '/requests', component: Requests, meta: { auth: true, title: 'Solicitações' } },
    { path: '/council', component: Council, meta: { auth: true, title: 'Conselho' } },
    { path: '/reports', component: Reports, meta: { auth: true, title: 'Relatórios' } },
    { path: '/admin', component: Admin, meta: { auth: true, roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'], title: 'Administração' } },
    { path: '/change-password', component: ChangePassword, meta: { auth: true, bare: true, title: 'Alterar senha' } },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuth();
  if (!auth.user) await auth.me();
  if (auth.user?.mustChangePassword && to.path !== '/change-password' && to.path !== '/login') {
    return '/change-password';
  }
  if (to.meta.auth && !auth.user) return '/login';
  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) return '/';
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · SGRD UTFPR` : 'SGRD · UTFPR';
});

export default router;
