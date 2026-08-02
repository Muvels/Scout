import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The shell document is served from chrome://shell, not from the dev server's
// own origin, so Vite's HMR client cannot derive its websocket address from
// the page. Pin the host and port while adding Tailwind's v4 Vite transform.
const port = Number(process.env.TBF_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    hmr: {
      host: '127.0.0.1',
      protocol: 'ws',
      clientPort: port,
    },
  },
});
