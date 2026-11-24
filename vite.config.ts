import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import appConfig from '../app/src/renderer/vite.config.ts';

// Cross-origin isolation enables SharedArrayBuffer for the backend workers.
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

const appModules = path.resolve(import.meta.dirname, '../app/node_modules');

// The app's renderer config (aliases, defines, plugins) with this project's
// entry and output.
export default mergeConfig(appConfig, defineConfig({
  root: import.meta.dirname,
  publicDir: path.resolve(import.meta.dirname, 'public'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    rolldownOptions: { input: { main: path.resolve(import.meta.dirname, 'index.html') } },
  },
  define: {
    // Never ship the desktop's service credentials in a public web bundle.
    JNBOT_BUILD_SECRETS: '{}',
  },
  resolve: {
    // Bare imports from this folder would otherwise walk up past ../app and
    // can pick up a second React or antd.
    alias: [{ find: /^(react|react-dom|antd)(\/.*)?$/, replacement: `${appModules}/$1$2` }],
  },
  server: { port: 5180, strictPort: false, headers, fs: { allow: [path.resolve(import.meta.dirname, '..')] } },
  preview: { headers },
}));
