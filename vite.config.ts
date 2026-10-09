import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // TypeScript zuerst auflösen: Vites Default ('.mjs', '.js', …) bevorzugt .js-Dateien.
  // Alte Legacy-Dateien (z. B. src/audio/playlist.js aus der 2D-Ära) würden sonst die
  // neuen .ts-Module verdrängen und den Build mit MISSING_EXPORT brechen.
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json']
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts']
  }
});
