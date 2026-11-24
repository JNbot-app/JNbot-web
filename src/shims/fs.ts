// Node `fs` for the backend: an in-memory volume that is saved to IndexedDB.
// Files under the backend URL path (minecraft-data, worker bundles) are read
// on demand from the web server, so the bundle does not have to embed them.
import { Volume, createFsFromVolume } from 'memfs';

const vol = new Volume();
const memfs = createFsFromVolume(vol) as any;

/** Paths below this prefix are fetched from the server; see scripts/build-backend.mjs. */
export const REMOTE_ROOT = '/backend/';
/** Paths that are never persisted. */
const VOLATILE = [REMOTE_ROOT, '/tmp/'];

const missing = new Set<string>();

function normalize(file: unknown): string | undefined {
  if (typeof file === 'string') return file;
  if (file instanceof URL) return file.pathname;
  return undefined;
}

/** Synchronous GET (allowed in workers); undefined when the server has no such file. */
function fetchSync(url: string): ArrayBuffer | undefined {
  const request = new XMLHttpRequest();
  request.open('GET', new URL(url, location.origin).href, false);
  request.responseType = 'arraybuffer';
  try {
    request.send();
  } catch {
    return undefined;
  }
  // SPA hosts answer unknown paths with index.html; only accept real files.
  const type = request.getResponseHeader('content-type') ?? '';
  return request.status === 200 && !type.includes('text/html') ? request.response : undefined;
}

let remoteDirs = false;
/** Creates the minecraft-data directories listed by scripts/build-backend.mjs. */
function loadRemoteDirs() {
  remoteDirs = true;
  const listing = fetchSync(`${REMOTE_ROOT}data/dirs.json`);
  if (!listing) return;
  for (const dir of JSON.parse(new TextDecoder().decode(listing)) as string[])
    vol.mkdirSync(`${REMOTE_ROOT}data/${dir}`, { recursive: true });
}

/** Loads a server file into the volume on first use. */
function ensureRemote(file: unknown) {
  const path = normalize(file);
  if (!path?.startsWith(REMOTE_ROOT)) return;
  if (!remoteDirs) loadRemoteDirs();
  if (missing.has(path) || vol.existsSync(path)) return;
  // See scripts/build-backend.mjs: gzip files are served as `.gz.bin`.
  const content = fetchSync(path.endsWith('.gz') ? `${path}.bin` : path);
  if (!content) {
    missing.add(path);
    return;
  }
  vol.mkdirSync(path.slice(0, path.lastIndexOf('/')) || '/', { recursive: true });
  vol.writeFileSync(path, new Uint8Array(content));
}

let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const markDirty = () => {
  dirty = true;
  if (!saveTimer) saveTimer = setTimeout(() => void persist(), 1000);
};

const WRITE = /^(write|append|mkdir|mkdtemp|rm|unlink|rename|copy|cp|truncate|symlink|link|utimes|chmod|createWriteStream)/;
const READ = /^(read|exists|stat|lstat|access|open|createReadStream|realpath)/;

function wrap<T extends Record<string, any>>(target: T): T {
  const wrapped: Record<string, any> = {};
  for (const key of Object.keys(target)) {
    const value = target[key];
    if (typeof value !== 'function' || /^[A-Z]/.test(key)) {
      wrapped[key] = value;
      continue;
    }
    wrapped[key] = (...args: any[]) => {
      if (READ.test(key)) ensureRemote(args[0]);
      if (WRITE.test(key)) markDirty();
      return value.apply(target, args);
    };
  }
  return wrapped as T;
}

const fs = wrap(memfs);
fs.promises = wrap(memfs.promises);
fs.constants = memfs.constants;

/* ---------- persistence ---------- */

const DB = 'jnbot-web';
const STORE = 'fs';
const KEY = 'volume';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function snapshot(): Record<string, Uint8Array | null> {
  const files: Record<string, Uint8Array | null> = {};
  const walk = (dir: string) => {
    for (const name of vol.readdirSync(dir) as string[]) {
      const path = dir === '/' ? `/${name}` : `${dir}/${name}`;
      if (VOLATILE.some((prefix) => `${path}/`.startsWith(prefix))) continue;
      if (vol.statSync(path).isDirectory()) {
        files[path] = null;
        walk(path);
      } else files[path] = new Uint8Array(vol.readFileSync(path) as Uint8Array);
    }
  };
  walk('/');
  return files;
}

export async function persist() {
  saveTimer = undefined;
  // Child workers get a read-only copy; only the backend owns the saved volume.
  if (!dirty || (globalThis as any).__jnbotThread) return;
  dirty = false;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(snapshot(), KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Restores the saved volume; call once before the backend touches fs. */
export async function restore() {
  const db = await openDb();
  const files = await new Promise<Record<string, Uint8Array | null> | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  for (const [path, content] of Object.entries(files ?? {})) {
    if (content === null) vol.mkdirSync(path, { recursive: true });
    else {
      vol.mkdirSync(path.slice(0, path.lastIndexOf('/')) || '/', { recursive: true });
      vol.writeFileSync(path, content);
    }
  }
  vol.mkdirSync('/tmp', { recursive: true });
}

export default fs;
