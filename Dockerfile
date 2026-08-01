FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN npm install --global pnpm@11.9.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build \
    && mkdir -p .next/standalone/.next \
    && cp -r .next/static .next/standalone/.next/static

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PGDATA=/var/lib/postgresql/data
ENV DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres
ENV HOME=/home/nextjs

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
       postgresql \
       tini \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.9.0 \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs --home /home/nextjs nextjs \
    && mkdir -p /home/nextjs \
    && chown nextjs:nodejs /home/nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./.next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/sql ./sql
COPY --from=builder --chown=nextjs:nodejs /app/data_pack ./data_pack
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
