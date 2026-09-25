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
    { path: '/login', component: Login },
    { path: '/', component: Dashboard, meta: { auth: true } },
    { path: '/requests', component: Requests, meta: { auth: true } },
    { path: '/council', component: Council, meta: { auth: true } },
    { path: '/reports', component: Reports, meta: { auth: true } },
    { path: '/admin', component: Admin, meta: { auth: true, roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'] } },
    { path: '/change-password', component: ChangePassword, meta: { auth: true } },
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

export default router;
