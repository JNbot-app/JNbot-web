// CommonJS face of shims/fs so `import { existsSync } from 'fs'` resolves at runtime.
module.exports = require('./fs.ts').default;
