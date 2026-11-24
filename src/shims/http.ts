// Outgoing requests use stream-http (fetch/XHR); servers are not available.
import http from 'stream-http';

export const createServer = () => {
  throw new Error('HTTP servers are not supported in the browser version of JNbot.');
};
export const { request, get, Agent, STATUS_CODES, METHODS, globalAgent } = http as any;
export default { ...(http as any), createServer };
