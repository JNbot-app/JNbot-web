// window.ipcRenderer for the in-browser backend: messenger frames go to the
// backend Web Worker (src/backend/main.ts) instead of Electron or a WebRTC peer.
import MessengerSocket from '../../../app/src/renderer/extra/peer2peer/MessengerSocket';
import type { EndpointTransport, TransportFrame } from '../../../app/src/common/messaging';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { BackendMessage, UiMessage } from '../backend/protocol';
import { showDesktopHint } from './desktopHint';
import { openUrl } from './openUrl';

const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'ws://localhost:8787';
const BACKUP_RELAY_URL = import.meta.env.VITE_BACKUP_RELAY_URL || undefined;

export default class WorkerSocket extends MessengerSocket {
  private worker?: Worker;
  private readonly receivers = new Set<(frame: TransportFrame) => void>();
  private ready = false;

  connect() {
    if (this.worker) return;
    const worker = new Worker(new URL('/backend/backend.js', location.href));
    this.worker = worker;
    const post = (message: UiMessage) => worker.postMessage(message);
    const transport: EndpointTransport = {
      send: (frame) => post({ kind: 'frame', frame }),
      sendAsync: async (frame) => post({ kind: 'frame', frame }),
      subscribe: (receiver) => {
        this.receivers.add(receiver);
        return () => this.receivers.delete(receiver);
      },
    };
    worker.onmessage = ({ data }: MessageEvent<BackendMessage>) => {
      if (data.kind === 'frame') for (const receiver of this.receivers) receiver(data.frame);
      else if (data.kind === 'event') this.emitLocal(data.event, data.data);
      else if (data.kind === 'open-url') openUrl(data.url, this.snackbar);
      else if (data.kind === 'reload') location.reload();
      else if (data.kind === 'assigned') this.attach(data.address, transport);
      else if (data.kind === 'ready') {
        this.ready = true;
        this.setUIStatus?.('connected');
        this.offerDesktop();
      }
      else if (data.kind === 'fatal') {
        this.setUIStatus?.('Could not start JNbot');
        this.snackbar?.error({ title: data.message });
      }
    };
    worker.onerror = (event) => {
      this.setUIStatus?.('Could not start JNbot');
      this.snackbar?.error({ title: event.message || 'The JNbot backend crashed.' });
    };
    // Save pending writes when the tab is hidden or closed.
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') post({ kind: 'flush' });
    });
    this.setUIStatus?.('Starting JNbot...');
    post({ kind: 'start', relayUrl: RELAY_URL, backupRelayUrl: BACKUP_RELAY_URL });
  }

  setSnackbar(snackbar: NotificationInstance) {
    super.setSnackbar(snackbar);
    this.offerDesktop();
  }

  /** Once the app is up and can show notifications. */
  private offerDesktop() {
    if (this.ready && this.snackbar) showDesktopHint(this.snackbar);
  }

  disconnect() {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
