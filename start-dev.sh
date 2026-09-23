#!/usr/bin/env bash
# SGRD — sobe backend (:3000) + frontend (:5173) para teste manual.
# Uso: ./start-dev.sh [--seed-dev] [--no-frontend] [--no-backend]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

SEED_DEV=0
NO_BACKEND=0
NO_FRONTEND=0
for arg in "$@"; do
  case "$arg" in
    --seed-dev) SEED_DEV=1 ;;
    --no-backend) NO_BACKEND=1 ;;
    --no-frontend) NO_FRONTEND=1 ;;
    *) echo "Opção desconhecida: $arg (use --seed-dev, --no-backend, --no-frontend)"; exit 1 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { echo "Faltando: $1"; exit 1; }; }
need node; need npm; need docker

[ -f "$BACKEND/.env" ] || { echo "Criando backend/.env a partir de .env.example"; cp "$BACKEND/.env.example" "$BACKEND/.env"; }

echo "== postgres local (compose, só o db) =="
(cd "$ROOT" && docker compose up -d db)

echo "== backend: install + migrate =="
npm --prefix "$BACKEND" install --no-audit --no-fund
(cd "$BACKEND" && npx prisma migrate dev)

if [ "$SEED_DEV" = 1 ]; then
  echo "== seed DEV (teste manual, NUNCA em produção) =="
  SEED_DEV_CONFIRM=1 npm --prefix "$BACKEND" run seed:dev
else
  echo "== seed deploy (só admin) =="
  npm --prefix "$BACKEND" run seed || true
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if [ "$NO_BACKEND" = 0 ]; then
  echo "== backend :3000 =="
  npm --prefix "$BACKEND" run dev &
fi
if [ "$NO_FRONTEND" = 0 ]; then
  echo "== frontend :5173 =="
  npm --prefix "$FRONTEND" install --no-audit --no-fund
  npm --prefix "$FRONTEND" run dev &
fi

echo ""
echo "Backend:  http://localhost:3000/health"
echo "Frontend: http://localhost:5173"
echo "Logins dev (senha Trocar123!): admin/chefe/cons/prof/aluno.teste@utfpr.edu.br"
echo "Ctrl+C encerra ambos."
wait
