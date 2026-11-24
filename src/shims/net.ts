// Node `net` over the relay: each Socket is one WebSocket that the relay pipes to
// a TCP connection. The relay sends the text frame "open" once TCP is connected.
// Servers the Cloudflare relay cannot reach go through the backup (Node) relay.
import { Duplex } from 'readable-stream';
import { Buffer } from 'buffer';
import { backupRelayUrl, cloudflareBlocked, relayUrl } from './relay';

/** Destinations the Cloudflare relay refused; later connections go to the backup directly. */
const viaBackup = new Set<string>();

type ConnectOptions = { host?: string; port?: number | string };

export class Socket extends Duplex {
  private ws?: WebSocket;
  private idleTimeout = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  connecting = false;
  pending = true;
  remoteAddress?: string;
  remotePort?: number;
  bytesRead = 0;
  bytesWritten = 0;

  constructor() {
    super({ allowHalfOpen: false } as any);
  }

  connect(...args: any[]): this {
    const callback = args.find((arg) => typeof arg === 'function');
    const options: ConnectOptions = typeof args[0] === 'object' ? args[0] : { port: args[0], host: args[1] };
    const host = options.host || 'localhost';
    const port = Number(options.port);
    if (callback) this.once('connect', callback);
    this.connecting = true;
    this.remoteAddress = host;
    this.remotePort = port;

    const backup = backupRelayUrl();
    this.open(backup && viaBackup.has(`${host}:${port}`) ? backup : relayUrl(), host, port);
    return this;
  }

  /** One WebSocket to `relay`; Cloudflare-refused destinations are retried once on the backup relay. */
  private open(relay: string, host: string, port: number) {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${relay}/tcp?host=${encodeURIComponent(host)}&port=${port}`);
    } catch (error) {
      queueMicrotask(() => this.destroy(error as Error));
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        if (event.data === 'open') {
          this.connecting = false;
          this.pending = false;
          this.touch();
          this.emit('connect');
          this.emit('ready');
        }
        return;
      }
      const chunk = Buffer.from(event.data as ArrayBuffer);
      this.bytesRead += chunk.length;
      this.touch();
      this.push(chunk);
    };
    ws.onclose = (event) => {
      this.clearIdle();
      if (this.connecting) {
        const backup = backupRelayUrl();
        if (backup && relay !== backup && cloudflareBlocked(event.reason) && !this.destroyed) {
          viaBackup.add(`${host}:${port}`);
          this.open(backup, host, port);
          return;
        }
        const error = Object.assign(new Error(event.reason || `connect ECONNREFUSED ${host}:${port}`), {
          code: 'ECONNREFUSED', address: host, port,
        });
        this.destroy(error);
        return;
      }
      this.push(null);
      this.destroy();
    };
    ws.onerror = () => undefined; // onclose follows with the reason
  }

  _read() {}

  _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      callback(Object.assign(new Error('This socket has been ended by the other party'), { code: 'EPIPE' }));
      return;
    }
    this.ws.send(chunk);
    this.bytesWritten += chunk.length;
    this.touch();
    callback();
  }

  _final(callback: () => void) {
    this.ws?.close();
    callback();
  }

  _destroy(error: Error | null, callback: (error: Error | null) => void) {
    this.clearIdle();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    callback(error);
  }

  setTimeout(ms: number, callback?: () => void) {
    this.idleTimeout = ms;
    if (callback) this.once('timeout', callback);
    this.touch();
    return this;
  }

  private touch() {
    this.clearIdle();
    if (this.idleTimeout > 0) this.idleTimer = setTimeout(() => this.emit('timeout'), this.idleTimeout);
  }

  private clearIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  setNoDelay() { return this; }
  setKeepAlive() { return this; }
  ref() { return this; }
  unref() { return this; }
  address() { return { address: '0.0.0.0', family: 'IPv4', port: 0 }; }
  get readyState() { return this.connecting ? 'opening' : this.ws?.readyState === WebSocket.OPEN ? 'open' : 'closed'; }
}

export function connect(...args: any[]) {
  return new Socket().connect(...args);
}
export const createConnection = connect;

export function createServer(): never {
  throw new Error('Listening for connections is not supported in the browser.');
}
export class Server {
  constructor() { createServer(); }
}

const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
export const isIPv4 = (input: string) => ipv4.test(input);
export const isIPv6 = (input: string) => input.includes(':') && /^[\da-f:.]+$/i.test(input);
export const isIP = (input: string) => (isIPv4(input) ? 4 : isIPv6(input) ? 6 : 0);

export default { Socket, Server, connect, createConnection, createServer, isIP, isIPv4, isIPv6 };
