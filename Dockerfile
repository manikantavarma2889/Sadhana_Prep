FROM node:24-bookworm-slim AS manifests
WORKDIR /srv
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

FROM manifests AS build
RUN npm ci --no-audit --no-fund
COPY shared ./shared
COPY backend ./backend
COPY frontend ./frontend
RUN npm run build

FROM manifests AS production
RUN npm ci --omit=dev --workspace backend --no-audit --no-fund

FROM node:24-bookworm-slim
WORKDIR /srv
COPY --from=production /srv/node_modules ./node_modules
COPY --from=build /srv/backend/dist ./backend/dist
COPY --from=build /srv/frontend/dist ./frontend/dist
COPY --from=manifests /srv/package.json ./package.json
WORKDIR /srv/backend
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "dist/backend/src/index.js"]
