// Shared by both relays: the Cloudflare Worker (index.ts) and the Node relay (node/server.ts).

/** Ports a Minecraft server can not be on (mail, ssh, the web...). */
const BLOCKED_PORTS = new Set([22, 23, 25, 80, 110, 143, 443, 465, 587, 993, 995]);
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd])/i;

/** The requested destination, or undefined when the relay must not connect to it. */
export function destination(url: URL): { host: string; port: number } | undefined {
  const host = url.searchParams.get('host') ?? '';
  const port = Number(url.searchParams.get('port'));
  if (!host || PRIVATE_HOST.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 || BLOCKED_PORTS.has(port))
    return undefined;
  return { host, port };
}

/** Comma-separated origins allowed to use the relay; empty allows any. */
export function originAllowed(origin: string | null | undefined, allowedOrigins = ''): boolean {
  const allowed = allowedOrigins.split(',').map((value) => value.trim()).filter(Boolean);
  return !allowed.length || allowed.includes(origin ?? '');
}
