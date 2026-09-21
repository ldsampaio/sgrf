function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isInstitutionalEmail(email) {
  return normalizeEmail(email).endsWith('@utfpr.edu.br');
}

function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Valor monetário inválido');
  return Math.round(n * 100);
}

function formatBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function randomTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = require('crypto').randomBytes(length);
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

module.exports = { normalizeEmail, isInstitutionalEmail, toCents, formatBRL, randomTempPassword };
