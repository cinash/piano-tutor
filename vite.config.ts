/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces so the port is reachable from outside the container.
    // VS Code forwards it, and the host must use http://localhost:5173 — localhost is a
    // secure context, which Web MIDI requires; a LAN or tailnet IP is not.
    host: '0.0.0.0',
    port: 5173,
    // Fail loudly on a port collision rather than silently moving to 5174, which would
    // break the forwarded-localhost assumption above.
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
