FROM node:20-slim

RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/

# Copy API package
COPY apps/api/ ./apps/api/

# Install dependencies (includes native modules like bcrypt)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build
RUN cd apps/api && npx nest build

# Run DB migrations on start, then launch
EXPOSE 3000
WORKDIR /app/apps/api
CMD npx prisma db push --skip-generate && node dist/main
