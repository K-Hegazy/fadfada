# ==========================================
# FADFADA (فضفضه) — Production Dockerfile for Google Cloud Run
# ==========================================

# 1. Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json bun.lock* ./
RUN npm ci

# Copy source code and build Vite frontend bundle
COPY . .
RUN npm run build

# 2. Production Runtime Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server code and assets
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/metadata.json ./metadata.json

# Pre-create data directories with proper permissions
RUN mkdir -p /app/data/uploads /app/data/backups

# Expose container port (Cloud Run sets PORT automatically)
EXPOSE 3000

# Start server using tsx
CMD ["npx", "tsx", "server.ts"]
