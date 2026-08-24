# --- Stage 1: build the frontend (Vite -> static files) ---
FROM node:22-slim AS frontend-build
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: install server dependencies ---
FROM node:22-slim AS server-deps
WORKDIR /repo/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# --- Stage 3: runtime image ---
FROM node:22-slim AS runtime
WORKDIR /repo

# Server code + its production dependencies
COPY server/ ./server/
COPY --from=server-deps /repo/server/node_modules ./server/node_modules

# Built frontend static files
COPY --from=frontend-build /repo/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /repo/server
CMD ["npm", "start"]
