# Build from the repo root so the workspace lockfile is available:
#   docker build -f packages/api/Dockerfile -t flagrship-api .
#
# Runtime needs one environment variable: DATABASE_URL. PORT defaults to 3000.

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Prisma's query engine links against OpenSSL.
RUN apk add --no-cache openssl

# Install with the lockfile before copying source, so this layer is cached
# until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/
COPY packages/cli/package.json packages/cli/
COPY packages/sdk-js/package.json packages/sdk-js/
COPY packages/landing/package.json packages/landing/
RUN npm ci --workspace=@flagrship/api --include-workspace-root

COPY packages/api/prisma packages/api/prisma
COPY packages/api/tsconfig.json packages/api/
COPY packages/api/src packages/api/src

RUN npx --workspace=@flagrship/api prisma generate \
 && npx --workspace=@flagrship/api tsc

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl \
 && addgroup -S app && adduser -S app -G app

# ponytail: devDependencies come along (typescript, vitest, ~60 MB) because the
# Prisma CLI is one of them and `migrate deploy` needs it at boot. Prune when
# image size is a problem someone actually has; until then, one fewer stage.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./
COPY --from=build --chown=app:app /app/packages/api/package.json ./packages/api/
COPY --from=build --chown=app:app /app/packages/api/prisma ./packages/api/prisma
COPY --from=build --chown=app:app /app/packages/api/dist ./packages/api/dist

USER app
WORKDIR /app/packages/api
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1

# Apply committed migrations, then serve. A deploy can never run ahead of its
# schema, because the same command gates both CI and boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
