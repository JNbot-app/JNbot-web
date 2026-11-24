// Entry wrapper for child workers (bot scripts, server probes): waits for the
// init message from shims/worker_threads, restores a copy of the volume, then
// runs the real worker module.
import { restore } from '../shims/fs';

export function startThread(run: () => void) {
  const g = globalThis as any;
  g.__jnbotBackendBase = new URL('./', location.href).href;
  const onInit = async (event: MessageEvent) => {
    const init = event.data?.__jnbotThreadInit;
    if (!init) return;
    removeEventListener('message', onInit);
    g.__jnbotThread = init;
    Object.assign(g.process.env, init.env);
    g.__jnbotExit = (code: number) => {
      postMessage({ __jnbotExit: code });
      close();
    };
    // Messages sent while the volume loads must reach the worker module.
    const queued: MessageEvent[] = [];
    const queue = (message: MessageEvent) => queued.push(message);
    addEventListener('message', queue);
    await restore();
    removeEventListener('message', queue);
    run();
    for (const message of queued) dispatchEvent(new MessageEvent('message', { data: message.data }));
  };
  addEventListener('message', onInit);
}
