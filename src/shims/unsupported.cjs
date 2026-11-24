// Node modules that have no browser equivalent (child_process, readline, vm, ...).
// Importing works; calling anything throws a clear error. The names are listed
// because bundlers copy a CommonJS module's own keys for named imports.
const names = [
  // child_process
  'spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork',
  // readline
  'createInterface', 'emitKeypressEvents', 'clearLine', 'clearScreenDown', 'cursorTo', 'moveCursor',
  // module
  'createRequire',
  // vm
  'Script', 'createContext', 'runInContext', 'runInNewContext', 'runInThisContext', 'compileFunction',
  // dgram, http2, inspector, cluster, repl
  'createSocket', 'connect', 'createServer', 'createSecureServer', 'open', 'url', 'Session', 'fork', 'setupPrimary', 'start',
];
const unsupported = (name) => () => {
  throw new Error(`${name} is not supported in the browser version of JNbot.`);
};
for (const name of names) exports[name] = unsupported(name);
exports.builtinModules = [];
exports.isPrimary = exports.isMaster = true;
exports.isWorker = false;
exports.isatty = () => false;
exports.performance = globalThis.performance;
exports.PerformanceObserver = globalThis.PerformanceObserver;
