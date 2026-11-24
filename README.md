# JNbot Web

JNbot Web runs JNbot entirely in your browser: no install and no server of your
own. It is the [JNbot desktop](https://github.com/JNbot-app/JNbot-desktop) app's
interface and bot runtime, compiled for the browser. Minecraft connections go
through a small Cloudflare Worker relay, because browsers cannot open TCP
connections themselves.

For bots that keep running when the tab is closed, and for every feature, use
the [desktop app](https://github.com/usserwout/JNbot-updater/releases/latest).

## Features

- Add servers, detect their gamemodes and manage profiles.
- Manage Minecraft accounts and join, monitor and control bots: chat, inventory, logs.
- Run scripts, plugins, chains and triggers.
- Everything is stored in the browser (IndexedDB).

## Limits

- Bots run only while the tab is open; browsers throttle background tabs.
- All users connect from the relays' IP addresses, so per-IP limits and bans
  are shared.
- Not available: Microsoft accounts, proxies, the Minecraft launcher, Discord,
  cloud backups, profile UI extensions and MCP over HTTP. Using them shows a
  "not supported in the browser version" error.

## How it works

```
page (React UI from the desktop app)
  └─ WorkerSocket ── messenger frames ──▶ backend.js (Web Worker, desktop backend)
                                            └─ main.worker.js (one Web Worker per script/bot)
                                                 └─ net shim ── WebSocket ──▶ relay ── TCP ──▶ Minecraft server
```

- `src/ui` – installs `WorkerSocket` as the app's `window.ipcRenderer`, then loads the desktop renderer.
- `src/backend` – Web Worker entries for the backend and script workers.
- `src/shims` – Node built-ins for the browser: `fs` (in memory, saved to
  IndexedDB; minecraft-data is fetched on demand), `net` (over the relay), `dns`
  (DNS-over-HTTPS), `worker_threads` (Web Workers), `vm`, `os`, `process`, …
- `relay` – Cloudflare Worker: WebSocket↔TCP for Minecraft, plus a CORS proxy for
  a fixed list of Microsoft/Mojang login APIs.
- `relay/node` – the same WebSocket↔TCP relay for Node (Render), used only for
  servers the Cloudflare relay cannot reach.

## Development

This repository has no UI or backend code of its own: it builds the desktop
checkout next to it. Clone both repositories side by side, with the desktop
checkout named `app`:

```bash
git clone https://github.com/JNbot-app/JNbot-desktop.git app
git clone https://github.com/JNbot-app/JNbot-web.git jnbot-web
```

Use Node 22 (`nvm use`), and install the desktop dependencies first:

```bash
cd app
npm install
cd ../jnbot-web
npm install
```

Then run the relay and the app in two terminals:

```bash
npm run relay:dev   # relay on ws://localhost:8787
npm run dev         # rebuilds the backend on change + Vite on http://localhost:5180
```

`npm run build` writes the site to `dist/`. Set `VITE_RELAY_URL` and
`VITE_BACKUP_RELAY_URL` (in `.env.local` or `.env.production`) to use other relays.

## Deploying to Cloudflare (free)

The site is static and runs on Cloudflare Pages; the relay is a Cloudflare
Worker (`relay/wrangler.toml`). Both fit the free plan: static files are free
and unlimited, and the relay counts one request per bot connection, out of
100,000 a day.

```bash
npx wrangler login
npm run relay:deploy        # prints https://jnbot-relay.<subdomain>.workers.dev
```

Put the relay URL in `.env.production` and deploy the site:

```
VITE_RELAY_URL=wss://jnbot-relay.<subdomain>.workers.dev
```

```bash
npx wrangler pages project create jnbot-web --production-branch main   # once
npm run deploy              # https://jnbot-web.pages.dev
```

Then set `ALLOWED_ORIGINS` in `relay/wrangler.toml` to the site's URL and run
`npm run relay:deploy` again, so other sites cannot use your relay.
`public/_headers` makes the page cross-origin isolated (needed for
SharedArrayBuffer) and caches minecraft-data.

### Backup relay on Render (free)

Cloudflare Workers cannot connect to servers on Cloudflare's own network (for
example Hypixel, JartexNetwork and PikaNetwork). When the Cloudflare relay
refuses a server, the app retries it once through the backup relay and uses the
backup for that server from then on. Everything else stays on Cloudflare.

1. On [Render](https://render.com), choose **New → Blueprint** and select this
   repository; `render.yaml` creates the `jnbot-relay` web service (free plan,
   `relay/` folder, `ALLOWED_ORIGINS` set to the site).
2. Add its URL to `.env.production` and deploy the site again:

   ```
   VITE_BACKUP_RELAY_URL=wss://jnbot-relay.onrender.com
   ```

A free Render service sleeps after 15 minutes without traffic and takes up to a
minute to wake; the app wakes it when the page loads. Run it locally with
`npm install --prefix relay` and `npm run relay:node` (port 8788). The relay also
runs on any server with Node 22.18+ (`PORT`, `ALLOWED_ORIGINS`, `MAX_CONNECTIONS`,
`MAX_PER_CLIENT`).

## License

[MIT](LICENSE)
