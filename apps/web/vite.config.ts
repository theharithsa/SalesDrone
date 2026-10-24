import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'api-portal-route',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.split('?')[0] === '/api/docs')
            req.url = '/api-docs.html';
          next();
        });
      },
    },
    {
      name: 'production-rum-tag',
      transformIndexHtml(html) {
        return command === 'build' &&
          process.env.VITE_ENABLE_RUM === 'true' &&
          process.env.VITE_USE_EMULATORS !== 'true'
          ? {
              html,
              tags: [
                {
                  tag: 'script',
                  attrs: { src: '/rum-bootstrap.js', defer: true },
                  injectTo: 'head',
                },
              ],
            }
          : html;
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(
      JSON.parse(
        readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
      ).version,
    ),
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('../../', import.meta.url)),
        realpathSync(
          fileURLToPath(new URL('../../node_modules', import.meta.url)),
        ),
      ],
    },
    proxy: {
      '^/api/v1(?:/|$)': {
        target: 'http://127.0.0.1:5001',
        rewrite: (p) => `/demo-salesdrone/asia-south1/api${p}`,
      },
    },
  },
  build: { chunkSizeWarningLimit: 750 },
}));
