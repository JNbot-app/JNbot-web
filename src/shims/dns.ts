// Node `dns` via DNS-over-HTTPS. Plain lookups return the hostname itself: the
// relay resolves it when it opens the TCP connection.
import { isIP } from './net';

type Callback<T> = (error: Error | null, result?: T) => void;
type SrvRecord = { name: string; port: number; priority: number; weight: number };

async function query(name: string, type: string) {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!response.ok) throw new Error(`DNS query failed (${response.status})`);
  const body = (await response.json()) as { Status: number; Answer?: { type: number; data: string }[] };
  if (body.Status !== 0 || !body.Answer?.length)
    throw Object.assign(new Error(`queryS${type} ENOTFOUND ${name}`), { code: 'ENOTFOUND', hostname: name });
  return body.Answer;
}

async function resolveSrvAsync(name: string): Promise<SrvRecord[]> {
  const answers = await query(name, 'SRV');
  return answers
    .filter((answer) => answer.type === 33)
    .map((answer) => {
      const [priority, weight, port, target] = answer.data.split(' ');
      return { priority: +priority, weight: +weight, port: +port, name: target.replace(/\.$/, '') };
    });
}

export function resolveSrv(name: string, callback: Callback<SrvRecord[]>) {
  resolveSrvAsync(name).then((records) => callback(null, records), (error) => callback(error));
}

export function lookup(hostname: string, options: unknown, callback?: (error: Error | null, address?: string, family?: number) => void) {
  const done = (typeof options === 'function' ? options : callback) as NonNullable<typeof callback>;
  const all = typeof options === 'object' && (options as { all?: boolean })?.all;
  const family = isIP(hostname) || 4;
  queueMicrotask(() => (all ? (done as any)(null, [{ address: hostname, family }]) : done(null, hostname, family)));
}

export const promises = {
  resolveSrv: resolveSrvAsync,
  lookup: (hostname: string) => Promise.resolve({ address: hostname, family: isIP(hostname) || 4 }),
};

export default { resolveSrv, lookup, promises };
