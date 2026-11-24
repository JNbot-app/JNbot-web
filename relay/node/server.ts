// JNbot web relay for Node (Render, any VPS): the backup for servers the
// Cloudflare Worker cannot reach (servers on Cloudflare's own network).
//   GET /tcp?host=&port=  WebSocket <-> TCP pipe, same protocol as the Worker:
//                         sends the text frame "open" once TCP is connected.
//   GET /health           200; the web app calls it early to wake a sleeping instance.
import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns';
import { WebSocketServer, type WebSocket } from 'ws';
import { destination, originAllowed } from '../src/rules.ts';

const PORT = Number(process.env.PORT || 8788);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? '';
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 200);
const MAX_PER_CLIENT = Number(process.env.MAX_PER_CLIENT || 20);
const CONNECT_TIMEOUT = 10_000;
const HIGH_WATER = 1 << 20;

/** Addresses a public relay must never reach, checked after DNS (hostnames can point anywhere). */
const privateRanges = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) privateRanges.addSubnet(address, prefix, 'ipv4');
// No ::ffff:0:0/96 rule: BlockList also matches every IPv4 address against it.
for (const [address, prefix] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const)
  privateRanges.addSubnet(address, prefix, 'ipv6');

const isPrivate = (address: string) => {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  return mapped ? privateRanges.check(mapped, 'ipv4') : privateRanges.check(address, net.isIPv6(address) ? 'ipv6' : 'ipv4');
};

// net.connect asks for every address (all: true) to try IPv4 and IPv6 in parallel.
const publicLookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: any[]) => void) =>
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (addresses.some(({ address }) => isPrivate(address)))
      return callback(Object.assign(new Error(`${hostname} resolves to a private address`), { code: 'EACCES' }));
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  })) as net.LookupFunction;

const perClient = new Map<string, number>();
let open = 0;

// Plain HTTP only answers health checks (Render's has no Origin) and wake-up calls;
// the origin check guards the WebSocket upgrade, which is the actual relay.
const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }).end('JNbot relay');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4 << 20 });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://relay');
  const reject = (status: number, message: string) => {
    socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  };
  if (url.pathname !== '/tcp') return reject(404, 'Not Found');
  if (!originAllowed(request.headers.origin, ALLOWED_ORIGINS)) return reject(403, 'Origin not allowed');
  const target = destination(url);
  // IP addresses skip the DNS lookup, so check them here.
  if (!target || (net.isIP(target.host) && isPrivate(target.host))) return reject(403, 'Destination not allowed');
  // Render (and most hosts) put the visitor's address first in x-forwarded-for.
  const client = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress).split(',')[0].trim();
  if (open >= MAX_CONNECTIONS || (perClient.get(client) ?? 0) >= MAX_PER_CLIENT) return reject(503, 'Relay busy');
  wss.handleUpgrade(request, socket, head, (ws) => pipe(ws, target.host, target.port, client));
});

function pipe(ws: WebSocket, host: string, port: number, client: string) {
  open++;
  perClient.set(client, (perClient.get(client) ?? 0) + 1);
  let connected = false;
  const tcp = net.connect({ host, port, lookup: publicLookup, noDelay: true, timeout: CONNECT_TIMEOUT });

  const close = (code: number, reason: string) => {
    if (ws.readyState <= ws.OPEN) ws.close(code, reason.slice(0, 120));
    tcp.destroy();
  };

  tcp.once('connect', () => {
    connected = true;
    tcp.setTimeout(0);
    ws.send('open');
  });
  tcp.on('timeout', () => close(1011, `connect ETIMEDOUT ${host}:${port}`));
  tcp.on('error', (error) =>
    close(1011, connected ? error.message : `connect ECONNREFUSED ${host}:${port} (${error.message})`),
  );
  tcp.on('close', () => close(1000, 'closed'));
  tcp.on('data', (chunk) => {
    ws.send(chunk);
    // Slow browser: stop reading from the server until the WebSocket drains.
    if (ws.bufferedAmount > HIGH_WATER) {
      tcp.pause();
      const resume = setInterval(() => {
        if (ws.bufferedAmount > HIGH_WATER / 2 && ws.readyState === ws.OPEN) return;
        clearInterval(resume);
        tcp.resume();
      }, 20);
    }
  });

  ws.on('message', (data, isBinary) => {
    if (!isBinary || !connected) return;
    if (!tcp.write(data as Buffer)) {
      ws.pause();
      tcp.once('drain', () => ws.resume());
    }
  });
  ws.on('close', () => {
    tcp.destroy();
    open--;
    const count = (perClient.get(client) ?? 1) - 1;
    if (count) perClient.set(client, count);
    else perClient.delete(client);
  });
  ws.on('error', () => tcp.destroy());
}

server.listen(PORT, () => console.log(`JNbot relay listening on ${PORT}`));
