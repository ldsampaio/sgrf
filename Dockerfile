# SGRF/SGRD — imagem única (API + frontend) p/ v0.1.1.
# Stage 1: build do frontend (Vite SPA).
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: backend + frontend compilado.
FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --no-audit --no-fund && npx prisma generate
COPY backend/src ./src
COPY backend/docker-entrypoint.sh ./
COPY --from=web /web/dist /app/frontend-dist
RUN chmod +x ./docker-entrypoint.sh \
  && addgroup --system app && adduser --system --ingroup app app \
  && mkdir -p /app/uploads && chown -R app:app /app
USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
