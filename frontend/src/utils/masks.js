export function formatBRL(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// "1.234,56" | "R$ 1.234,56" | "1234.56" -> centavos int
export function parseBRLToCents(str) {
  if (str == null) return 0;
  let s = String(str).trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error('Valor inválido');
  return Math.round(n * 100);
}

export function formatCentsInput(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ddmmaaaa -> dd/mm/aaaa (máscara progressiva)
export function maskDateDigits(digits) {
  const d = String(digits).replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function brToISO(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br || ''));
  if (!m) throw new Error('Data inválida (dd/mm/aaaa)');
  const [, dd, mm, yyyy] = m;
  const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
  if (Number.isNaN(dt.getTime())) throw new Error('Data inválida');
  return dt.toISOString();
}

export function isoToBR(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
