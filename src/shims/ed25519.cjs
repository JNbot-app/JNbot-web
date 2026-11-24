// Node's Ed25519 KeyObject API (the only asymmetric keys the backend uses:
// plugin signatures, marketplace approvals, publisher and relay identities).
// crypto-browserify has no Ed25519.
const { Buffer } = require('./buffer.cjs');
const { ed25519 } = require('@noble/curves/ed25519');

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

const unsupported = () => {
  throw new Error('Only Ed25519 keys are supported in the browser version.');
};

class KeyObject {
  constructor(type, raw) {
    this.type = type;
    this.raw = raw;
    this.asymmetricKeyType = 'ed25519';
  }

  export({ format = 'pem' } = {}) {
    const isPublic = this.type === 'public';
    const der = Buffer.concat([isPublic ? SPKI_PREFIX : PKCS8_PREFIX, this.raw]);
    if (format === 'der') return der;
    const label = isPublic ? 'PUBLIC KEY' : 'PRIVATE KEY';
    const body = der.toString('base64').match(/.{1,64}/g).join('\n');
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
  }
}

function toKey(input) {
  const key = input && typeof input === 'object' && 'key' in input ? input.key : input;
  if (key instanceof KeyObject) return key;
  const der =
    typeof key === 'string' ? Buffer.from(key.replace(/-----[^-]+-----|\s/g, ''), 'base64') : Buffer.from(key);
  if (der.length === 44 && der.subarray(0, 12).equals(SPKI_PREFIX)) return new KeyObject('public', der.subarray(12));
  if (der.length === 48 && der.subarray(0, 16).equals(PKCS8_PREFIX)) return new KeyObject('private', der.subarray(16));
  return unsupported();
}

const publicKeyOf = (key) =>
  key.type === 'public' ? key : new KeyObject('public', Buffer.from(ed25519.getPublicKey(key.raw)));

module.exports = {
  KeyObject,
  createPublicKey: (input) => publicKeyOf(toKey(input)),
  createPrivateKey: (input) => {
    const key = toKey(input);
    return key.type === 'private' ? key : unsupported();
  },
  generateKeyPairSync: (type) => {
    if (type !== 'ed25519') unsupported();
    const privateKey = new KeyObject('private', Buffer.from(ed25519.utils.randomPrivateKey()));
    return { privateKey, publicKey: publicKeyOf(privateKey) };
  },
  sign: (algorithm, data, key) => {
    const privateKey = toKey(key);
    if (algorithm || privateKey.type !== 'private') unsupported();
    return Buffer.from(ed25519.sign(data, privateKey.raw));
  },
  verify: (algorithm, data, key, signature) => {
    if (algorithm) unsupported();
    try {
      return ed25519.verify(signature, data, publicKeyOf(toKey(key)).raw);
    } catch {
      return false;
    }
  },
};
