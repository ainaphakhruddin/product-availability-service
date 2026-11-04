# ---- build: install all deps and compile TypeScript ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime: production deps + compiled JS only ----
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/app/data/products.db
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json openapi.yaml ./
RUN mkdir -p /app/data && chown -R node:node /app
# Run as an unprivileged user
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
