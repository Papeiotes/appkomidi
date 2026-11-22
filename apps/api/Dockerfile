FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vardia/shared build && pnpm --filter @vardia/api build
WORKDIR /app/apps/api
ENV PORT=4107
EXPOSE 4107
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
