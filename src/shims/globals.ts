// Injected into every backend bundle before any module runs (esbuild `inject`).
import { Buffer } from 'buffer';
import process from './process';
import { installFetchProxy } from './relay';

const g = globalThis as any;
g.global = g;
g.process = process;
g.Buffer = Buffer;
g.setImmediate ??= (fn: (...args: unknown[]) => void, ...args: unknown[]) => setTimeout(fn, 0, ...args);
g.clearImmediate ??= (id: number) => clearTimeout(id);
// Without cross-origin isolation SharedArrayBuffer does not exist; the backend
// only uses it for a small counter, which then is simply not shared.
g.SharedArrayBuffer ??= ArrayBuffer;
installFetchProxy();

export { process, Buffer };
