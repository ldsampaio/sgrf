const { z } = require('zod');
const { normalizeEmail, isInstitutionalEmail } = require('./helpers');

const ROLES = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'];

const itemSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().min(3),
  role: z.enum(ROLES),
});

function parseBatch(buffer) {
  let arr;
  try {
    arr = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Arquivo JSON inválido'), { status: 400 });
  }
  if (!Array.isArray(arr)) throw Object.assign(new Error('JSON deve ser um array'), { status: 400 });
  if (arr.length < 1 || arr.length > 200) {
    throw Object.assign(new Error('Lote deve ter 1–200 usuários'), { status: 400 });
  }
  return arr;
}

function validateBatch(arr, existingEmails = new Set()) {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  arr.forEach((raw, index) => {
    const r = itemSchema.safeParse(raw);
    if (!r.success) {
      invalid.push({ index, email: raw?.email || null, error: r.error.issues[0]?.message || 'Inválido' });
      return;
    }
    const email = normalizeEmail(r.data.email);
    if (!isInstitutionalEmail(email)) {
      invalid.push({ index, email, error: 'Use e-mail @utfpr.edu.br' });
      return;
    }
    if (seen.has(email) || existingEmails.has(email)) {
      invalid.push({ index, email, error: 'E-mail duplicado' });
      return;
    }
    seen.add(email);
    valid.push({ ...r.data, email });
  });
  return { valid, invalid, summary: { total: arr.length, valid: valid.length, invalid: invalid.length } };
}

module.exports = { parseBatch, validateBatch, ROLES };
