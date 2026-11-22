# Build from the monorepo root. NEXT_PUBLIC_API_URL is baked in at build time:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4107
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vardia/shared build && pnpm --filter @vardia/web build
WORKDIR /app
EXPOSE 4108
CMD ["pnpm", "--filter", "@vardia/web", "start"]
