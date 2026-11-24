// The buffer polyfill plus Node's 'base64url' encoding (keys, signatures,
// share ids). Its base64 decoder already accepts '-' and '_'.
const buffer = require('../../node_modules/buffer/index.js');

const { Buffer } = buffer;
const isUrl = (encoding) => typeof encoding === 'string' && encoding.toLowerCase() === 'base64url';
const encoding = (value) => (isUrl(value) ? 'base64' : value);
const { from, byteLength, isEncoding } = Buffer;
const { toString } = Buffer.prototype;

Buffer.from = function (value, encodingOrOffset, length) {
  return from.call(this, value, typeof value === 'string' ? encoding(encodingOrOffset) : encodingOrOffset, length);
};
Buffer.byteLength = (value, enc) => byteLength(value, encoding(enc));
Buffer.isEncoding = (enc) => isUrl(enc) || isEncoding(enc);
Buffer.prototype.toString = function (enc, start, end) {
  if (!isUrl(enc)) return toString.apply(this, arguments);
  return toString.call(this, 'base64', start, end).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

module.exports = buffer;
