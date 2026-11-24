// Script worker (bots/plugins): app/src/main/src/workers/main.worker.js on a Web Worker.
import { startThread } from './thread';

startThread(() => require('../../../app/src/main/src/workers/main.worker.js'));
