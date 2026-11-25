import type { Address, TransportFrame } from '../../../app/src/common/messaging';

/** UI -> backend worker */
export type UiMessage =
  | { kind: 'start'; relayUrl: string; backupRelayUrl?: string }
  | { kind: 'frame'; frame: TransportFrame }
  | { kind: 'flush' };

/** backend worker -> UI */
export type BackendMessage =
  | { kind: 'assigned'; address: Address }
  | { kind: 'frame'; frame: TransportFrame }
  /** An app-wide event the desktop sends to its window (`global.send`). */
  | { kind: 'event'; event: string; data: unknown }
  /** Open a page the backend cannot open itself (the Dropbox sign-in). */
  | { kind: 'open-url'; url: string }
  /** Restart JNbot, as the desktop relaunches after switching storage. */
  | { kind: 'reload' }
  | { kind: 'ready' }
  | { kind: 'fatal'; message: string };
