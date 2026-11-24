// crypto-browserify plus Ed25519 and the Web Crypto helpers newer Node code uses.
const crypto = require('../../node_modules/crypto-browserify/index.js');

Object.assign(crypto, require('./ed25519.cjs'));

// Its digests encode through string_decoder, which has no 'base64url'.
const withBase64UrlDigest = (create) => (...args) => {
  const hash = create(...args);
  const digest = hash.digest.bind(hash);
  hash.digest = (encoding) => (encoding === 'base64url' ? digest().toString('base64url') : digest(encoding));
  return hash;
};
crypto.createHash = withBase64UrlDigest(crypto.createHash);
crypto.createHmac = withBase64UrlDigest(crypto.createHmac);

crypto.webcrypto = globalThis.crypto;
crypto.subtle = globalThis.crypto.subtle;
crypto.randomUUID = () => globalThis.crypto.randomUUID();
crypto.getRandomValues = (array) => globalThis.crypto.getRandomValues(array);
crypto.timingSafeEqual ??= (a, b) => {
  if (a.length !== b.length) throw new RangeError('Input buffers must have the same byte length');
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};
module.exports = crypto;
