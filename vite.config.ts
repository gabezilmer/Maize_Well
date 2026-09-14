import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^leaflet-draw$/,
        replacement: fileURLToPath(
          new URL('./src/lib/leaflet-draw-shim.js', import.meta.url),
        ),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
