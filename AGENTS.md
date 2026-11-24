# Agent guidelines

This repository is glue around the [JNbot desktop](https://github.com/JNbot-app/JNbot-desktop)
checkout in `../app`; its `AGENTS.md` applies here as well.

- Do not copy UI or backend code from `../app`. Import it, and make the shared
  code work in the browser with shims (`src/shims`) or small changes in `../app`
  that keep the desktop and mobile apps working.
- Shims only implement what the backend actually uses, and fail with a clear
  "not supported in the browser version" error otherwise.
- After changing `scripts/build-backend.mjs`, restart `npm run dev`; the watcher
  does not reload the build script.
- Never ship service credentials: the web bundles are public.
- Keep the relay's login allow-list (`relay/src/index.ts`) and `src/shims/relay.ts` in sync.
  Destination rules shared by both relays live in `relay/src/rules.ts`.
