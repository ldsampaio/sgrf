/**
 * Chaves EC P-256 para firmar JWTs de prueba.
 *
 * `jsonwebtoken` no acepta una clave privada PEM para ES256, así que aquí se
 * firma con `crypto` y se verifica con `jwks-rsa` usando `getSigningKey` — el
 * mismo camino que usa `src/utils/tokens.js` en producción.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const keypair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const kid = 'test-key-1';

const jwks = {
  keys: [
    {
      kid,
      kty: 'EC',
      crv: 'P-256',
      x: keypair.publicKey.export({ format: 'jwk' }).x,
      y: keypair.publicKey.export({ format: 'jwk' }).y,
      use: 'sig',
      alg: 'ES256',
    },
  ],
};

function signToken(claims, { expiresIn = '1h', keyId = kid } = {}) {
  return jwt.sign(claims, keypair.privateKey, { algorithm: 'ES256', keyid: keyId, expiresIn });
}

/**
 * Implemementación mínima de `getSigningKey` compatible con la que usa
 * `src/utils/tokens.js`.
 */
function getSigningKey(header) {
  const key = jwks.keys.find((k) => k.kid === header.kid);
  if (!key) throw new Error(`kid desconocido: ${header.kid}`);
  return key;
}

module.exports = { kid, jwks, signToken, getSigningKey, privateKey: keypair.privateKey };
