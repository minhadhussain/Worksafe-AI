FROM node:22-alpine AS deps
WORKDIR /app/apps/admin
COPY apps/admin/package.json apps/admin/package-lock.json ./
COPY shared /app/shared
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app/apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/v1
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ARG NEXT_PUBLIC_WORKER_ID=W-001
ARG NEXT_PUBLIC_WORKER_TOKEN=dev_device_worker_001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_WORKER_ID=$NEXT_PUBLIC_WORKER_ID \
    NEXT_PUBLIC_WORKER_TOKEN=$NEXT_PUBLIC_WORKER_TOKEN
COPY --from=deps /app/apps/admin/node_modules ./node_modules
COPY apps/admin ./
COPY shared /app/shared
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
