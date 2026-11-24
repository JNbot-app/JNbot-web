import { Buffer } from 'buffer';

export async function buffer(stream: AsyncIterable<Uint8Array | string>) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
export const text = async (stream: AsyncIterable<Uint8Array | string>) => (await buffer(stream)).toString('utf8');
export const json = async (stream: AsyncIterable<Uint8Array | string>) => JSON.parse(await text(stream));
export default { buffer, text, json };
