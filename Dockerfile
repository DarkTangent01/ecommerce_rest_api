# --- build: compile TypeScript (dev tooling such as TypeScript/ESLint needs Node >= 20) ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# --- runtime: production dependencies + compiled output only ---
# TODO: Node 18 is end-of-life; moving the runtime to node:20-alpine is pending sign-off.
FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock ./
# --ignore-engines: the lockfile includes dev tools that declare Node >= 20; none are installed here.
RUN yarn install --frozen-lockfile --production --ignore-engines && yarn cache clean

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 5000

RUN mkdir -p uploads logs && addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.APP_PORT || 5000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
