# Build from the monorepo root:
#   docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update -o Acquire::ForceIPv4=true -o Acquire::Retries=3 -o Acquire::http::Timeout=30 \
  && apt-get install -y --no-install-recommends -o Acquire::ForceIPv4=true openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vardia/shared build \
  && pnpm --filter @vardia/api exec prisma generate \
  && pnpm --filter @vardia/api build
WORKDIR /app/apps/api
ENV TZ=Europe/Athens
EXPOSE 4107
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
