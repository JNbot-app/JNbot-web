// Installs the in-browser backend as window.ipcRenderer, then starts the
// desktop renderer unchanged (its App.tsx keeps a preset ipcRenderer).
import WorkerSocket from './WorkerSocket';

window.web = true;
window.peering = false;
window.localBackend = true;
window.ipcRenderer = new WorkerSocket() as unknown as Window['ipcRenderer'];

await import('../../../app/src/renderer/index');
