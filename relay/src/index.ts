// JNbot web relay (Cloudflare Worker).
//   GET /tcp?host=&port=  WebSocket <-> TCP pipe for Minecraft connections.
//                         Sends the text frame "open" once TCP is connected.
//   ANY /fetch?url=       CORS proxy for the Minecraft/Microsoft login APIs.
import { connect } from 'cloudflare:sockets';
import { destination, originAllowed } from './rules.ts';

interface Env {
  /** Comma-separated origins allowed to use the relay; empty allows any. */
  ALLOWED_ORIGINS?: string;
}

/** Keep in sync with PROXIED_HOSTS in src/shims/relay.ts. */
const PROXIED_HOSTS = new Set([
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') ?? '';
    if (!originAllowed(origin, env.ALLOWED_ORIGINS)) return new Response('Origin not allowed', { status: 403 });
    const cors = {
      'access-control-allow-origin': origin || '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? '*',
      'access-control-max-age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/tcp') return tcp(request, url);
    if (url.pathname === '/fetch') return proxy(request, url, cors);
    return new Response('JNbot relay', { headers: cors });
  },
};

function tcp(request: Request, url: URL): Response {
  if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
  const target = destination(url);
  if (!target) return new Response('Destination not allowed', { status: 403 });
  const { host, port } = target;

  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  const close = (code: number, reason: string) => {
    try { server.close(code, reason.slice(0, 120)); } catch { /* already closed */ }
  };

  const socket = connect({ hostname: host, port });
  const writer = socket.writable.getWriter();
  socket.opened.then(
    () => server.send('open'),
    (error) => close(1011, `connect ECONNREFUSED ${host}:${port} (${error?.message ?? error})`),
  );
  server.addEventListener('message', (event) => {
    if (typeof event.data === 'string') return;
    writer.write(new Uint8Array(event.data as ArrayBuffer)).catch(() => close(1011, 'write failed'));
  });
  server.addEventListener('close', () => void socket.close().catch(() => undefined));
  socket.readable
    .pipeTo(new WritableStream({ write: (chunk) => server.send(chunk) }))
    .then(() => close(1000, 'closed'), (error) => close(1011, String(error?.message ?? error)));

  return new Response(null, { status: 101, webSocket: client });
}

async function proxy(request: Request, url: URL, cors: Record<string, string>): Promise<Response> {
  let target: URL;
  try {
    target = new URL(url.searchParams.get('url') ?? '');
  } catch {
    return new Response('Bad url', { status: 400, headers: cors });
  }
  if (target.protocol !== 'https:' || !PROXIED_HOSTS.has(target.hostname))
    return new Response('Host not allowed', { status: 403, headers: cors });
  const headers = new Headers(request.headers);
  for (const name of ['origin', 'referer', 'cookie', 'host']) headers.delete(name);
  for (const name of [...headers.keys()]) if (name.startsWith('cf-') || name.startsWith('x-forwarded')) headers.delete(name);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
  const response = new Response(upstream.body, upstream);
  response.headers.delete('set-cookie');
  for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
  response.headers.set('access-control-expose-headers', '*');
  return response;
}
