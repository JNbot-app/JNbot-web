// Node `os` with the values a browser worker can honestly report.
export const EOL = '\n';
export const homedir = () => '/home';
export const tmpdir = () => '/tmp';
export const hostname = () => 'browser';
export const platform = () => 'linux';
export const type = () => 'Linux';
export const release = () => '';
export const arch = () => 'wasm';
export const endianness = () => 'LE';
export const uptime = () => performance.now() / 1000;
export const cpus = () => Array.from({ length: navigator.hardwareConcurrency || 1 }, () => ({ model: 'browser', speed: 0, times: {} }));
export const totalmem = () => ((navigator as any).deviceMemory ?? 4) * 1024 ** 3;
export const freemem = () => totalmem() / 2;
export const loadavg = () => [0, 0, 0];
export const networkInterfaces = () => ({});
export const userInfo = () => ({ username: 'web', uid: 1000, gid: 1000, shell: null, homedir: homedir() });
export const constants = { signals: {}, errno: {} };
export default { EOL, homedir, tmpdir, hostname, platform, type, release, arch, endianness, uptime, cpus, totalmem, freemem, loadavg, networkInterfaces, userInfo, constants };
