import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // Configurável para rodar os três sistemas juntos em dev (saga :8000, sgoa :3000,
    // sgrf :3001). Defaults preservados.
    port: Number(process.env.VITE_PORT || 5173),
    proxy: { '/api': process.env.VITE_API_TARGET || 'http://localhost:3000' },
  },
});
