#!/bin/sh
# Entrypoint do deploy: migrações + seed do admin e então sobe a API.
# seed.js é idempotente (sai sem erro se o admin já existe).
set -e
npx prisma migrate deploy
node prisma/seed.js || true
exec "$@"
