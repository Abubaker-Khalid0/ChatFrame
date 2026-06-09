import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The .env lives at the repo root (one level up from frontend/), so point
// Vite's env loading there. VITE_-prefixed vars are exposed to the client.
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.FRONTEND_PORT ?? 5173),
      strictPort: false,
    },
  };
});
