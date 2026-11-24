// Node `worker_threads` on Web Workers. A child is a bundle next to the backend
// (`<backend>/<basename>`); its first message carries workerData and env, which
// src/backend/thread.ts installs before the worker module runs.
import { EventEmitter } from 'events';
import { persist } from './fs';

type ThreadInit = { workerData: unknown; threadId: number; env: Record<string, string | undefined> };

const thread: ThreadInit | undefined = (globalThis as any).__jnbotThread;

export const isMainThread = !thread;
export const threadId = thread?.threadId ?? 0;
export const workerData = thread?.workerData ?? null;
export const SHARE_ENV = Symbol('SHARE_ENV');
export const resourceLimits = {};

class ParentPort extends EventEmitter {
  postMessage(message: unknown, transfer?: Transferable[]) {
    (globalThis as any).postMessage(message, transfer ?? []);
  }
  start() {}
  close() {}
  ref() {}
  unref() {}
}

export const parentPort: ParentPort | null = thread ? new ParentPort() : null;
if (parentPort) {
  addEventListener('message', (event) => parentPort.emit('message', (event as MessageEvent).data));
}

let nextThreadId = 1;

export class Worker extends EventEmitter {
  readonly threadId = nextThreadId++;
  private readonly worker: globalThis.Worker;
  private exited = false;
  /** Messages posted before the init message went out. */
  private pending: [unknown, Transferable[]][] | null = [];

  constructor(filename: string | URL, options: { workerData?: unknown; env?: Record<string, string | undefined> | symbol; eval?: boolean } = {}) {
    super();
    if (options.eval) throw new Error('Workers from source code are not supported in the browser version of JNbot.');
    const name = String(filename).split(/[\\/]/).pop()!;
    this.worker = new globalThis.Worker(new URL(name, (globalThis as any).__jnbotBackendBase ?? location.href));
    this.worker.onmessage = (event) => {
      const data = event.data;
      if (data && typeof data === 'object' && '__jnbotExit' in data) this.exit(data.__jnbotExit);
      else this.emit('message', data);
    };
    this.worker.onmessageerror = () => this.emit('messageerror', new Error('Could not deserialize message'));
    this.worker.onerror = (event) => {
      event.preventDefault();
      this.emit('error', new Error(event.message || `Worker ${name} failed`));
      this.exit(1);
    };
    const env = typeof options.env === 'object' ? options.env : {};
    const init: ThreadInit = { workerData: options.workerData, threadId: this.threadId, env: { ...process.env, ...env } };
    // The child restores the saved volume, so save pending writes first.
    void persist().catch(() => undefined).then(() => {
      this.worker.postMessage({ __jnbotThreadInit: init });
      for (const [message, transfer] of this.pending ?? []) this.worker.postMessage(message, transfer);
      this.pending = null;
    });
    queueMicrotask(() => this.emit('online'));
  }

  postMessage(message: unknown, transfer?: Transferable[]) {
    if (this.exited) return;
    if (this.pending) this.pending.push([message, transfer ?? []]);
    else this.worker.postMessage(message, transfer ?? []);
  }

  terminate() {
    this.exit(1);
    return Promise.resolve(1);
  }

  private exit(code: number) {
    if (this.exited) return;
    this.exited = true;
    this.worker.terminate();
    this.emit('exit', code);
  }

  ref() { return this; }
  unref() { return this; }
}

export class MessageChannel extends globalThis.MessageChannel {}
export const receiveMessageOnPort = () => undefined;
export const markAsUntransferable = () => undefined;
export const getEnvironmentData = () => undefined;
export const setEnvironmentData = () => undefined;

export default {
  isMainThread, threadId, workerData, parentPort, Worker, SHARE_ENV, resourceLimits,
  MessageChannel, receiveMessageOnPort, markAsUntransferable, getEnvironmentData, setEnvironmentData,
};
