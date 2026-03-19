# ================================
# Stage 1: Build
# ================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files truoc de cache layer npm install
COPY package*.json ./

RUN npm ci

# Copy source code
COPY . .

# Build TypeScript -> JavaScript
RUN npm run build

# ================================
# Stage 2: Production
# ================================
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Chi cai production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files tu builder
COPY --from=builder /app/dist ./dist

# Tao user non-root de bao mat
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "dist/main.js"]
