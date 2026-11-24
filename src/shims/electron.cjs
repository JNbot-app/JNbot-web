// src/cli/mocks sets global.electron before anything imports electron.
module.exports = globalThis.electron || {};
