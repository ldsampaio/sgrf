#!/bin/sh
# Entrypoint do deploy: migrações (só o schema `sgrf`) + papel do admin e então sobe a API.
# seed.js grava só o papel em sgrf.user_roles; ele não cria identidade — `auth.users` é do
# saga e nasce no primeiro login. Idempotente (sai sem erro se o papel já existe).
set -e
npx prisma migrate deploy
node prisma/seed.js || true
exec "$@"
