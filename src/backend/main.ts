// Backend Web Worker: runs the same CLI runtime as the mobile backend
// (app/src/mobile-backend/main.ts) and exchanges messenger frames with the UI.
import { BACKEND, type Address, type TransportFrame } from '../../../app/src/common/messaging';
import { unrestrictedPermissions } from '../../../app/src/common/clientPermissions';
import { persist, restore } from '../shims/fs';
import type { BackendMessage, UiMessage } from './protocol';

// Frames are JSON on every other transport (native bridge, WebRTC); match that
// so values that cannot be cloned (functions) are dropped the same way.
const send = (message: BackendMessage) => {
  if (message.kind === 'frame') message = { kind: 'frame', frame: JSON.parse(JSON.stringify(message.frame)) };
  else if (message.kind === 'event') message = { ...message, data: JSON.parse(JSON.stringify(message.data ?? null)) };
  postMessage(message);
};
const principal = { kind: 'trusted-local', subjectId: 'web', permissions: unrestrictedPermissions() } as const;

let registration: { address: Address; receive(frame: TransportFrame): void } | undefined;
let storage: { flush(): Promise<unknown> } | undefined;

async function start(relayUrl: string, backupRelayUrl = '') {
  const g = globalThis as any;
  g.__jnbotBackendBase = new URL('./', location.href).href;
  Object.assign(process.env, {
    JNBOT_RELAY_URL: relayUrl,
    JNBOT_BACKUP_RELAY_URL: backupRelayUrl,
    JNBOT_USER_DATA: '/data',
    JNBOT_MOBILE_RUNTIME: 'true',
    // workerEntryPath() and minecraft-data (MC_DATA_PATH) resolve below this;
    // shims/fs fetches those files from the server on first read.
    JNBOT_WORKER_ROOT: '/backend',
    CLI_MODE: 'true',
  });
  // A free Render instance sleeps when idle; start waking it before a bot needs it.
  if (backupRelayUrl) fetch(`${backupRelayUrl.replace(/^ws/, 'http')}/health`).catch(() => undefined);
  await restore();
  // `src/cli/mocks` reads the env at evaluation time, so import after setting it.
  const [{ createCliRuntime }, { backendMessaging }, { createClientBootstrap }] = await Promise.all([
    import('../../../app/src/cli/v2/runtime'),
    import('../../../app/src/main/src/messaging'),
    import('../../../app/src/main/src/messaging/bootstrap'),
  ]);
  const { createWebStorage, registerWebStorageHandlers } = await import('./storage');
  storage = createWebStorage();
  const runtime = await createCliRuntime({ kind: 'mobile', storageMode: storage });
  const settings = runtime.handler.settings;
  registerWebStorageHandlers(storage, () => runtime.handler, {
    openUrl: (url) => send({ kind: 'open-url', url }),
    // Save this tab's data first: the reload starts the backend from IndexedDB.
    reload: () => void persist().finally(() => send({ kind: 'reload' })),
  });
  // Remote clients only get profile publications. This tab is the backend's own
  // window, so it also gets the app-wide events the desktop sends to its window
  // (MACROS, MC_SERVERS_UPDATE, ...); `socket === true` means peers only.
  const sendToPeers = g.send as (event: string, data: unknown, socket?: unknown) => void;
  g.send = (event: string, data: unknown, socket?: unknown) => {
    if (socket !== true) {
      try {
        send({ kind: 'event', event, data });
      } catch (error) {
        console.warn(`[jnbot-web] could not send ${event} to the page`, error);
      }
    }
    sendToPeers(event, data, socket);
  };
  registration = backendMessaging.registerRemoteClient((frame) => send({ kind: 'frame', frame }), principal);
  const address = registration.address;
  const bootstrap = (): TransportFrame => ({
    envelope: {
      version: 1, type: 'send', event: 'remote:bootstrap', from: BACKEND, to: address,
      data: createClientBootstrap(settings, principal),
    },
  });
  send({ kind: 'assigned', address });
  send({ kind: 'frame', frame: bootstrap() });
  settings.on('JNdata', () => send({ kind: 'frame', frame: bootstrap() }));
  send({ kind: 'ready' });
}

addEventListener('message', (event: MessageEvent<UiMessage>) => {
  const message = event.data;
  if (message.kind === 'start')
    start(message.relayUrl, message.backupRelayUrl).catch((error) => {
      console.error('[jnbot-web] backend startup failed', error instanceof Error ? error.stack : error);
      send({ kind: 'fatal', message: error instanceof Error ? error.message : String(error) });
    });
  else if (message.kind === 'frame') registration?.receive(message.frame);
  // Upload pending Dropbox changes too: they are otherwise sent a few seconds later.
  else if (message.kind === 'flush') void Promise.allSettled([persist(), storage?.flush()]);
});
