import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth';
import Login from '../views/Login.vue';
import Unavailable from '../views/Unavailable.vue';
import Dashboard from '../views/Dashboard.vue';
import Requests from '../views/Requests.vue';
import Admin from '../views/Admin.vue';

import Council from '../views/Council.vue';
import Reports from '../views/Reports.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Página de redirecionamento para o saga — o sgrf não autentica credencial.
    { path: '/login', name: 'login', component: Login, meta: { public: true, bare: true, title: 'Entrar' } },
    // Página de erro própria (503 IDENTITY_UNAVAILABLE). Não é o caminho do 401:
    // redirecionar para o serviço que caiu é o loop que se quer evitar.
    { path: '/unavailable', name: 'unavailable', component: Unavailable, meta: { public: true, bare: true, title: 'Indisponível' } },
    { path: '/', component: Dashboard, meta: { auth: true, title: 'Dashboard' } },
    { path: '/requests', component: Requests, meta: { auth: true, title: 'Solicitações' } },
    { path: '/council', component: Council, meta: { auth: true, title: 'Conselho' } },
    { path: '/reports', component: Reports, meta: { auth: true, title: 'Relatórios' } },
    { path: '/admin', component: Admin, meta: { auth: true, roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'], title: 'Administração' } },
  ],
});

// O guard não decide o destino: ele bloqueia a navegação e deixa plugins/auth.js
// executar a ação do contrato (401 → saga; 503 → página própria). Assim o guard e
// as chamadas em voo não competem por dois redirects.
router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  const auth = useAuth();
  if (!auth.user) {
    const user = await auth.me();
    if (!user) return false;
  }

  if (to.meta.roles && !to.meta.roles.includes(auth.user.role)) return '/';
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · SGRD UTFPR` : 'SGRD · UTFPR';
});

export default router;
