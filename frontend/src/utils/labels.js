// Shared human-readable labels. Keeps status/role/type vocabulary consistent
// across screens while raw API enums stay untouched.

export const TYPE_LABELS = {
  EQUIPAMENTO: 'Equipamento',
  PUBLICACAO: 'Publicação',
  VIAGEM: 'Viagem',
  AUXILIO_ESTUDANTIL: 'Auxílio estudantil',
};

export const typeLabel = (type) => TYPE_LABELS[type] || type || '—';

export const ROLE_LABELS = {
  ADMINISTRADOR: 'Administrador',
  CHEFE_DEPARTAMENTO: 'Chefia',
  CONSELHEIRO: 'Conselheiro',
  PROFESSOR: 'Professor',
  ALUNO: 'Aluno',
};

export const roleLabel = (role) => ROLE_LABELS[role] || role || '—';

export const VOTE_LABELS = {
  DEFERIR: 'Deferir',
  INDEFERIR: 'Indeferir',
  DEFERIR_PARCIALMENTE: 'Deferir parcialmente',
  ABSTER_SE: 'Abster-se',
};

export const voteLabel = (vote) => VOTE_LABELS[vote] || vote || '—';

export const VOTE_TONES = {
  DEFERIR: 'success',
  INDEFERIR: 'danger',
  DEFERIR_PARCIALMENTE: 'warning',
  ABSTER_SE: 'neutral',
};

export const voteTone = (vote) => VOTE_TONES[vote] || 'neutral';

export function initials(value) {
  const base = String(value || '').trim();
  if (!base) return '?';
  const parts = base.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '?';
  const second = parts.length > 1 ? parts[1][0] : (parts[0]?.[1] || '');
  return `${first}${second}`.toUpperCase();
}
