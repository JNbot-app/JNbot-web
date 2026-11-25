// Bundles the app's backend (../app/src) for Web Workers into public/backend,
// mapping Node built-ins to src/shims and node-stdlib-browser.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import stdlib from 'node-stdlib-browser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.resolve(root, '../app');
const out = path.join(root, 'public/backend');
const dataSource = path.join(app, 'node_modules/minecraft-data/minecraft-data/data');
const shim = (file) => path.join(root, 'src/shims', file);
const require = createRequire(import.meta.url);

const unsupported = shim('unsupported.cjs');
const builtins = {
  // node-stdlib-browser maps to package directories (or null for no polyfill).
  ...Object.fromEntries(Object.entries(stdlib).map(([name, dir]) => [name, dir && require.resolve(dir)])),
  fs: shim('fs-node.cjs'),
  'fs/promises': shim('fs-promises.ts'),
  net: shim('net.ts'),
  tls: shim('net.ts'),
  dns: shim('dns.ts'),
  'dns/promises': shim('dns-promises.ts'),
  'stream/consumers': shim('stream-consumers.ts'),
  worker_threads: shim('worker_threads.ts'),
  v8: shim('v8.ts'),
  async_hooks: shim('async_hooks.ts'),
  http: shim('http.ts'),
  https: shim('http.ts'),
  process: shim('process.ts'),
  os: shim('os.ts'),
  events: shim('events.cjs'),
  vm: shim('vm.ts'),
  crypto: shim('crypto.cjs'),
  buffer: shim('buffer.cjs'),
  child_process: unsupported,
  cluster: unsupported,
  dgram: unsupported,
  http2: unsupported,
  inspector: unsupported,
  module: unsupported,
  readline: unsupported,
  repl: unsupported,
  tty: unsupported,
  perf_hooks: unsupported,
  'stream/promises': require.resolve('readable-stream/lib/internal/streams/end-of-stream.js'),
};

/** Desktop-only packages: importable, but using them throws. */
const disabledPackages = /^(electron-updater|electron-debug|@sentry\/electron|discord\.js|@xmcl\/.*|@modelcontextprotocol\/node|xxhash-wasm|werift|esbuild-wasm|esbuild|@aws-sdk\/.*|ink|qrcode-terminal|node-machine-id)$/;

const nodeShims = {
  name: 'node-shims',
  setup(build) {
    build.onResolve({ filter: /^(node:)?[a-z0-9_]+(\/[a-z_]+)?$/ }, (args) => {
      const name = args.path.replace(/^node:/, '');
      if (!(name in builtins)) return undefined;
      return { path: builtins[name] ?? unsupported };
    });
    build.onResolve({ filter: /^electron$/ }, () => ({ path: shim('electron.cjs') }));
    build.onResolve({ filter: /^@xmcl\/installer$/ }, () => ({ path: shim('xmcl-installer.cjs') }));
    build.onResolve({ filter: disabledPackages }, () => ({ path: unsupported }));
    // Its "browser" entry leaves out the client; the shims make the Node one work.
    build.onResolve({ filter: /^minecraft-protocol$/ }, () => ({ path: path.join(app, 'node_modules/minecraft-protocol/src/index.js') }));
    // Same replacements as the mobile backend (app/scripts/build-mobile-backend.mjs).
    build.onLoad({ filter: /src\/main\/src\/functions\/transpile\.ts$/ }, () => ({
      contents: fs.readFileSync(path.join(app, 'src/mobile-backend/mobileTranspile.ts'), 'utf8'),
      loader: 'ts', resolveDir: path.join(app, 'src/mobile-backend'),
    }));
    build.onLoad({ filter: /src\/main\/src\/workers\/bot\/proxyV3\/wasmParser\.ts$/ }, () => ({
      contents: fs.readFileSync(path.join(app, 'src/mobile-backend/tolerantParser.ts'), 'utf8'),
      loader: 'ts', resolveDir: path.join(app, 'src/mobile-backend'),
    }));
  },
};

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: {
    backend: path.join(root, 'src/backend/main.ts'),
    'main.worker': path.join(root, 'src/backend/script.worker.ts'),
  },
  outdir: out,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  keepNames: true,
  logLevel: 'info',
  nodePaths: [path.join(app, 'node_modules'), path.join(root, 'node_modules')],
  inject: [shim('globals.ts')],
  define: {
    __dirname: '"/backend"',
    __filename: '"/backend/backend.js"',
    'process.env.CLI_MODE': '"true"',
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
    // Never ship the desktop's service credentials in a public web bundle.
    JNBOT_BUILD_SECRETS: '{}',
  },
  loader: { '.node': 'empty', '.wasm': 'empty' },
  plugins: [nodeShims],
};

// minecraft-data is read on demand by shims/fs from /backend/data. Hosts send
// `.gz` files with Content-Encoding: gzip, which makes the browser unpack them,
// so they are served as `.gz.bin`.
fs.rmSync(path.join(out, 'data'), { recursive: true, force: true });
for (const file of fs.readdirSync(dataSource, { recursive: true })) {
  const source = path.join(dataSource, file);
  if (fs.statSync(source).isDirectory()) continue;
  const target = path.join(out, 'data', file.endsWith('.gz') ? `${file}.bin` : file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
// shims/fs creates these up front so directory checks work before any file is read.
const dataDirs = fs.readdirSync(dataSource, { recursive: true }).filter((file) => fs.statSync(path.join(dataSource, file)).isDirectory());
fs.writeFileSync(path.join(out, 'data', 'dirs.json'), JSON.stringify(dataDirs));

if (watch) await (await esbuild.context(options)).watch();
else await esbuild.build(options);
