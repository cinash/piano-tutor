/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The built app loads nothing from anywhere but its own origin. GitHub Pages cannot send
// headers, so the policy rides in a meta tag, and only in the build: the dev server injects
// the inline scripts and styles it would block.
// OSMD draws its cursor as a data: image; base-uri and form-action do not fall back to default-src.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  // Relative asset URLs, so the same build serves at / (k3s, preview) and at /piano-tutor/
  // (GitHub Pages).
  base: './',
  plugins: [
    react(),
    {
      name: 'content-security-policy',
      apply: 'build',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: 'head-prepend',
        },
      ],
    },
  ],
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
    setupFiles: ['src/testSetup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
