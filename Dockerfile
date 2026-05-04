# syntax=docker/dockerfile:1.6

# ---------- Stage 1: dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runner

ENV NODE_ENV=development \
    PORT=3000

WORKDIR /app

RUN apk add --no-cache tini curl \
    && addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .

RUN mkdir -p public/temp && chown -R app:app public

USER app

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "index.js"]
