FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first (for docker caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code files
COPY . .

# Run production build compilation
RUN npm run build

# Final stage runner
FROM node:24-alpine AS runner

WORKDIR /app

# Copy built bundles and dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start Next.js server
CMD ["npm", "run", "start"]
