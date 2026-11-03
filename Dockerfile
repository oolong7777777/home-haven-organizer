FROM node:24-bookworm-slim AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
COPY shared/ /app/shared/
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/database.sqlite
WORKDIR /app
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev && mkdir -p /data && chown node:node /data
COPY server/ ./server/
COPY shared/ ./shared/
COPY --from=frontend /app/client/dist ./client/dist
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
