# syntax=docker/dockerfile:1

FROM node:22-slim AS builder

WORKDIR /app

# Cai dependencies truoc de tan dung Docker layer cache khi chi sua source code
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY assets ./assets

RUN npm run build


FROM node:22-slim AS runner

# Cai tzdata & ca-certificates de cron job chay dung mui gio Viet Nam (UTC+7)
# va goi HTTPS toi Cloudinary, Google OAuth, PayOS, SMTP on dinh
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

RUN mkdir -p /app/uploads \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
