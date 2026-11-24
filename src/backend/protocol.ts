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
  | { kind: 'ready' }
  | { kind: 'fatal'; message: string };
