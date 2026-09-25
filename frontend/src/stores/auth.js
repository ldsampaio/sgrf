import { defineStore } from 'pinia';
import { api } from '../services/api';

export const useAuth = defineStore('auth', {
  state: () => ({ user: null }),
  actions: {
    async me() {
      try { const { data } = await api.get('/auth/me'); this.user = data.user; }
      catch { this.user = null; }
    },
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      this.user = data.user;
    },
    async logout() { try { await api.post('/auth/logout'); } catch { /* best-effort: dead session is the desired end state */ } finally { this.user = null; } },
  },
});
