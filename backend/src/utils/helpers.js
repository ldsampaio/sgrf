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

// T10: nenhuma credencial existe no sgrf — não há geração de senha temporária.
module.exports = { normalizeEmail, isInstitutionalEmail, toCents, formatBRL };
