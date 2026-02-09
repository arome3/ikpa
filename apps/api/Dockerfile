FROM node:20-slim AS base

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/

# Copy API package
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma/ ./apps/api/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy API source
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build
RUN cd apps/api && npx nest build

# Production stage
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/prisma ./apps/api/prisma
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/packages ./packages

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main"]
