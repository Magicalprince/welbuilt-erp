# --- Stage 1: build the frontend (Vite -> static files) ---
# Vite inlines VITE_-prefixed vars at BUILD time, not container start time,
# so they must arrive as build args (Dokploy: application build args), not
# runtime environment variables. Docker will warn "SecretsUsedInArgOrEnv" on
# the Firebase ones below - that's a false positive here: the Firebase Web
# config is a public client identifier by design (real access control is
# Firestore Security Rules, not this key), and it ends up in the public JS
# bundle either way, regardless of how it's passed into the build.
FROM node:22-slim AS frontend-build
WORKDIR /repo/frontend

ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_R2_ENDPOINT
ARG VITE_R2_BUCKET_NAME
ARG VITE_R2_PUBLIC_URL

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
