// Node `process` for the browser workers: an EventEmitter (the backend listens for
// uncaughtException and emits its own events) with the fields the code reads.
import { EventEmitter } from 'events';

const start = performance.now();
const proc = new EventEmitter() as EventEmitter & Record<string, any>;

Object.assign(proc, {
  title: 'browser',
  browser: true,
  pid: 1,
  ppid: 0,
  arch: 'wasm',
  platform: 'linux',
  version: 'v20.0.0',
  versions: { node: '20.0.0' },
  release: { name: 'node' },
  env: { NODE_ENV: 'production' } as Record<string, string | undefined>,
  argv: ['/jnbot', '/jnbot'],
  execArgv: [],
  execPath: '/jnbot',
  exitCode: undefined,
  stdout: { isTTY: false, write: (chunk: unknown) => (console.log(String(chunk)), true), on() {} },
  stderr: { isTTY: false, write: (chunk: unknown) => (console.error(String(chunk)), true), on() {} },
  stdin: { isTTY: false, on() {}, resume() {}, pause() {} },
  cwd: () => '/',
  chdir() {},
  umask: () => 0o22,
  uptime: () => (performance.now() - start) / 1000,
  nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => fn(...args)),
  hrtime: Object.assign(
    (prev?: [number, number]) => {
      const now = performance.now();
      const sec = Math.floor(now / 1000);
      const nsec = Math.floor((now % 1000) * 1e6);
      if (!prev) return [sec, nsec];
      const diff = (sec - prev[0]) * 1e9 + nsec - prev[1];
      return [Math.floor(diff / 1e9), diff % 1e9];
    },
    { bigint: () => BigInt(Math.floor(performance.now() * 1e6)) },
  ),
  memoryUsage: Object.assign(
    () => {
      const heap = (performance as any).memory?.usedJSHeapSize ?? 0;
      return { rss: heap, heapUsed: heap, heapTotal: heap, external: 0, arrayBuffers: 0 };
    },
    { rss: () => (performance as any).memory?.usedJSHeapSize ?? 0 },
  ),
  cpuUsage: () => ({ user: 0, system: 0 }),
  resourceUsage: () => ({}),
  emitWarning: (warning: unknown) => console.warn(warning),
  binding() { throw new Error('process.binding is not supported'); },
  kill() { return true; },
  // A script worker ends by asking its parent to terminate it; the backend
  // itself never exits.
  exit(code = 0) {
    proc.exitCode = code;
    const exitHook = (globalThis as any).__jnbotExit;
    if (exitHook) exitHook(code);
    else console.warn(`[jnbot-web] process.exit(${code}) ignored`);
  },
  abort() { proc.exit(134); },
});

// Route uncaught browser errors to the handlers the backend registers.
addEventListener('error', (event: ErrorEvent) => {
  if (proc.listenerCount('uncaughtException') === 0) return;
  event.preventDefault();
  proc.emit('uncaughtException', event.error ?? new Error(event.message));
});
addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (proc.listenerCount('unhandledRejection') === 0) return;
  event.preventDefault();
  proc.emit('unhandledRejection', event.reason);
});

export default proc;
