// The relay (relay/src/index.ts) is the browser's way out: WebSocket <-> TCP for
// Minecraft connections, and an HTTP proxy for login APIs without CORS headers.

/** Hosts the relay proxies HTTP requests for; keep in sync with the relay. */
export const PROXIED_HOSTS = new Set([
  'login.live.com',
  'login.microsoftonline.com',
  'user.auth.xboxlive.com',
  'xsts.auth.xboxlive.com',
  'device.auth.xboxlive.com',
  'title.auth.xboxlive.com',
  'sisu.xboxlive.com',
  'api.minecraftservices.com',
  'sessionserver.mojang.com',
  'api.mojang.com',
]);

export function relayUrl(): string {
  const url = (globalThis as any).process?.env?.JNBOT_RELAY_URL;
  if (!url) throw new Error('No relay configured (JNBOT_RELAY_URL).');
  return url.replace(/\/$/, '');
}

/** The Node relay (relay/node) for servers the Cloudflare relay cannot reach; may be unset. */
export function backupRelayUrl(): string | undefined {
  return (globalThis as any).process?.env?.JNBOT_BACKUP_RELAY_URL?.replace(/\/$/, '') || undefined;
}

/** Cloudflare Workers can not connect to servers on Cloudflare's own network. */
export const cloudflareBlocked = (reason: string) => reason.includes('cannot connect to the specified address');

/** The relay URL for a request to a proxied host, or undefined to send it directly. */
function proxied(input: string | URL): string | undefined {
  const url = new URL(String(input), location.href);
  if (!PROXIED_HOSTS.has(url.hostname)) return undefined;
  return `${relayUrl().replace(/^ws/, 'http')}/fetch?url=${encodeURIComponent(url.href)}`;
}

/** Routes fetch and XMLHttpRequest (axios) calls to proxied hosts through the relay. */
export function installFetchProxy() {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const target = proxied(input instanceof Request ? input.url : input);
    if (!target) return nativeFetch(input, init);
    return input instanceof Request ? nativeFetch(new Request(target, input), init) : nativeFetch(target, init);
  };
  const open = XMLHttpRequest.prototype.open as (...args: any[]) => void;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
    open.call(this, method, proxied(url) ?? url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
}
