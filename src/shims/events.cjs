// The `events` polyfill plus the newer static helpers the backend uses.
const events = require('../../node_modules/events/events.js');

events.setMaxListeners ??= (n, ...targets) => {
  for (const target of targets) target.setMaxListeners?.(n);
};
events.getEventListeners ??= (emitter, name) => emitter.listeners?.(name) ?? [];
events.addAbortListener ??= (signal, listener) => {
  signal.addEventListener('abort', listener, { once: true });
  return { [Symbol.dispose]: () => signal.removeEventListener('abort', listener) };
};
module.exports = events;
