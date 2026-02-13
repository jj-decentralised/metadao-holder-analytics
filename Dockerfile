# Multi-stage Dockerfile for Next.js 16 app (Node 20, Alpine)

# 1) Builder: install deps, build, prune dev deps
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies to shrink runtime layer
RUN npm prune --omit=dev

# 2) Runner: copy build output and production deps
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production

# Copy production node_modules and built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Optional: copy next.config (not required at runtime but harmless)
COPY --from=builder /app/next.config.* ./

# Railway will inject PORT; default to 3000 for local runs
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npm run start -- -p ${PORT:-3000}"]