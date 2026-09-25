const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: '15m' });
}

function signRefresh(user) {
  return jwt.sign({ sub: user.id, typ: 'refresh' }, env.jwtRefreshSecret, { expiresIn: '7d' });
}

function verifyAccess(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

function verifyRefresh(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

const cookieOpts = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
};

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, cookieOpts };
