#!/usr/bin/env bash
# deploy-prod.sh — Deploy SGRF em produção via Docker Compose (imagem GHCR)
#
# Pré-requisitos no servidor:
#   - Docker Engine + docker compose v2
#   - Usuário no grupo docker: sudo usermod -aG docker $USER
#   - Cloudflare Tunnel apontando para a porta APP_PORT configurada abaixo
#
# Uso:
#   cd /opt/sgrf          # diretório onde o repo foi clonado
#   ./deploy-prod.sh
#
set -euo pipefail

# ── Helpers ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
NC='\033[0m'
info()  { echo -e "${CYAN}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }

prompt() {
  local desc="$1" default="$2" resp
  read -rp "$(echo -e "${CYAN}?${NC} $desc [$default]: ")" resp
  if [ -z "$resp" ]; then echo "$default"; else echo "$resp"; fi
}

gen_secret()    { openssl rand -base64 36 | tr -d '\n=' | head -c 48; }
gen_password()  { openssl rand -base64 24 | tr -d '\n=' | head -c 32; }

# ── Pre-check ────────────────────────────────────────────────────────────
check_prereqs() {
  local fail=0
  for cmd in docker openssl curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "Comando não encontrado: $cmd"
      fail=1
    fi
  done
  if ! docker compose version >/dev/null 2>&1; then
    err "docker compose não disponível"
    fail=1
  fi
  if ! groups | grep -qw docker; then
    warn "Usuário não pertence ao grupo 'docker'."
    warn "Execute: sudo usermod -aG docker \$USER && newgrp docker"
    fail=1
  fi
  [ "$fail" -eq 0 ] || { echo; err "Corrija os pré-requisitos e reinicie."; exit 1; }
}

# ── Script principal ─────────────────────────────────────────────────────
echo
info "=== SGRF — Deploy em Produção ==="
echo

check_prereqs
ok "Pré-requisitos OK"

# Check compose.yaml exists
if [ ! -f "compose.yaml" ]; then
  err "compose.yaml não encontrado. Execute este script no diretório do projeto (onde está compose.yaml)."
  exit 1
fi

echo
info "--- Configuração do deploy ---"

APP_PORT=$(prompt "Porta de entrada (APP_PORT) — configure o cloudflared para encaminhar para esta porta" "8081")
FRONTEND_URL=$(prompt "URL pública do site (FRONTEND_URL) — ex: https://sgrf.seudominio.edu.br" "http://localhost:${APP_PORT}")
ADMIN_EMAIL=$(prompt "E-mail do admin inicial" "ldsampaio@utfpr.edu.br")
IMAGE_TAG=$(prompt "Tag da imagem GHCR" "v0.1.4")

# COOKIE_SECURE
echo
read -rp "$(echo -e "${YELLOW}?${NC} Usar COOKIE_SECURE=true? (HTTPS/Cloudflare) [Y/n]: ")" cook
COOKIE_SECURE="true"
case "${cook:-Y}" in
  [Nn]|[Nn][Oo]) COOKIE_SECURE="false" ;;
esac

# Generate secrets
info "--- Gerando secrets seguros ---"
JWT_ACCESS_SECRET=$(gen_secret)
JWT_REFRESH_SECRET=$(gen_secret)
ADMIN_PASS=$(gen_password)

cat <<EOF
  JWT_ACCESS_SECRET      : ${JWT_ACCESS_SECRET} (48 chars)
  JWT_REFRESH_SECRET     : ${JWT_REFRESH_SECRET} (48 chars)
  INITIAL_ADMIN_PASSWORD : ${ADMIN_PASS} (32 chars)
EOF
warn "SALVE a senha temporária do admin acima. Expira em 24h, exige troca no primeiro login."

# ── SMTP Configuration ─────────────────────────────────────────────────────
echo
info "--- Configuração SMTP (e-mail institucional) ---"
read -rp "$(echo -e "${CYAN}?${NC} Servidor SMTP [smtp.utfpr.edu.br]: \")" SMTP_HOST
SMTP_HOST="${SMTP_HOST:-smtp.utfpr.edu.br}"
read -rp "$(echo -e "${CYAN}?${NC} Porta SMTP [587]: \")" SMTP_PORT
SMTP_PORT="${SMTP_PORT:-587}"
read -rp "$(echo -e "${YELLOW}?${NC} Usar conexão segura TLS (porta 465)? [y/N]: \")" smtp_tls
SMTP_SECURE="false"
case "${smtp_tls:-N}" in
  [Yy]|[Yy][Ee][Ss]) SMTP_SECURE="true"; SMTP_PORT="465" ;;
esac
SMTP_USER="sistemas-dacom-cp@utfpr.edu.br"
read -s -p "$(echo -e "${YELLOW}?${NC} Senha do e-mail SMTP (${SMTP_USER}): \")" SMTP_PASS
echo
info "SMTP configurado para envio de e-mails institucionais (${SMTP_USER})."

# ── Write .env ──────────────────────────────────────────────────────────
info "--- Criando .env ---"
cat > .env <<EOF
# Produção — gerado por deploy-prod.sh
APP_PORT=${APP_PORT}
COOKIE_SECURE=${COOKIE_SECURE}
FRONTEND_URL=${FRONTEND_URL}

JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
INITIAL_ADMIN_EMAIL=${ADMIN_EMAIL}
INITIAL_ADMIN_TEMPORARY_PASSWORD=${ADMIN_PASS}

# SMTP (e-mail institucional)
SMTP_ENABLED=true
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=SGRD <${SMTP_USER}>

SGRF_IMAGE_TAG=${IMAGE_TAG}
EOF
ok ".env criado (não versionado — já está no .gitignore)"

# ── Write compose.prod.yaml ─────────────────────────────────────────────
info "--- Criando compose.prod.yaml ---"
cat > compose.prod.yaml <<'EOF'
# Overlay de produção — usa imagem GHCR em vez de build local
# Aplicação: imagem única (API + SPA servido pelo Express)
services:
  app:
    build: null
    image: ghcr.io/ldsampaio/sgrf:${SGRF_IMAGE_TAG:-v0.1.4}
EOF
ok "compose.prod.yaml criado"

# ── Pull image ──────────────────────────────────────────────────────────
info "--- Fazendo pull da imagem GHCR ---"
SGRF_IMAGE_TAG="${IMAGE_TAG}" docker compose -f compose.yaml -f compose.prod.yaml pull 2>&1
ok "Imagem ${IMAGE_TAG} baixada"

# ── Deploy ──────────────────────────────────────────────────────────────
info "--- Subindo stack (app + db) ---"
SGRF_IMAGE_TAG="${IMAGE_TAG}" docker compose -f compose.yaml -f compose.prod.yaml --env-file .env up -d
ok "Stack iniciada"

# ── Verify ──────────────────────────────────────────────────────────────
info "--- Aguardando aplicação ficar pronta ---"
READY=0
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  # Check container didn't crash
  if docker compose -f compose.yaml -f compose.prod.yaml ps --format '{{.State}}' app 2>/dev/null | grep -q 'Exited'; then
    warn "Container app encerrou inesperadamente. Últimos logs:"
    docker compose -f compose.yaml -f compose.prod.yaml logs --tail=20 app
    exit 1
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  err "App não respondeu no /health após 30 tentativas."
  docker compose -f compose.yaml -f compose.prod.yaml logs -f app
  exit 1
fi

# ── Result ──────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOY CONCLUÍDO — SGRF v${IMAGE_TAG}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo
echo "  App:         http://localhost:${APP_PORT}"
echo "  Health:      http://localhost:${APP_PORT}/health"
echo "  Admin email: ${ADMIN_EMAIL}"
echo "  Admin senha: ${ADMIN_PASS}"
echo "  SMTP:        ${SMTP_USER} @ ${SMTP_HOST}:${SMTP_PORT} (TLS: ${SMTP_SECURE})"
echo "  Image:       ghcr.io/ldsampaio/sgrf:${IMAGE_TAG}"
echo
echo "  Cloudflare Tunnel deve encaminhar para a porta ${APP_PORT}."
echo "  Para logs:   docker compose -f compose.yaml -f compose.prod.yaml logs -f app"
echo "  Para parar:  docker compose -f compose.yaml -f compose.prod.yaml down"
echo
