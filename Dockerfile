# syntax=docker/dockerfile:1
# One repo → four Railway services. Set PHINDU_SERVICE=api|office|marketing|borrower
ARG PHINDU_SERVICE=office

# ---------- Nest API ----------
FROM node:20-alpine AS api-build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

FROM node:20-alpine AS api
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/dist ./dist
COPY --from=api-build /app/prisma ./prisma
COPY --from=api-build /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]

# ---------- Vite frontends ----------
FROM node:20-alpine AS fe-build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY apps/staff-web/package.json apps/staff-web/
COPY packages/shared/package.json packages/shared/
COPY apps/borrower-mobile/package.json apps/borrower-mobile/
RUN npm ci
COPY . .

ARG PHINDU_SERVICE=office
ARG VITE_SUPABASE_URL=https://yqrfheavftgybhcafzpt.supabase.co
ARG VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA
ARG VITE_API_URL=
ARG VITE_SITE_MODE=
ARG VITE_BORROWER_APP_URL=
ARG VITE_OFFICE_BASE_URL=
ARG VITE_MARKETING_BASE_URL=
ARG VITE_VAPID_PUBLIC_KEY=

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BORROWER_APP_URL=$VITE_BORROWER_APP_URL
ENV VITE_OFFICE_BASE_URL=$VITE_OFFICE_BASE_URL
ENV VITE_MARKETING_BASE_URL=$VITE_MARKETING_BASE_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN set -eu; \
  if [ "$PHINDU_SERVICE" = "marketing" ]; then export VITE_SITE_MODE=marketing; \
  elif [ "$PHINDU_SERVICE" = "office" ]; then export VITE_SITE_MODE=office; \
  elif [ -n "$VITE_SITE_MODE" ]; then export VITE_SITE_MODE; \
  else export VITE_SITE_MODE=office; \
  fi; \
  echo "Building PHINDU_SERVICE=$PHINDU_SERVICE VITE_SITE_MODE=$VITE_SITE_MODE"; \
  if [ "$PHINDU_SERVICE" = "borrower" ]; then \
    npm run build:borrower; \
    mkdir -p /out && cp -R apps/borrower-mobile/dist/. /out/; \
  else \
    npm run build:staff; \
    mkdir -p /out && cp -R dist/. /out/; \
  fi

FROM nginx:1.27-alpine AS web
COPY deploy/railway/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/railway/frontend-entrypoint.sh /frontend-entrypoint.sh
RUN sed -i 's/\r$//' /frontend-entrypoint.sh && chmod +x /frontend-entrypoint.sh && rm -f /etc/nginx/conf.d/default.conf
COPY --from=fe-build /out /usr/share/nginx/html
EXPOSE 8080
CMD ["/frontend-entrypoint.sh"]

# ---------- Select runtime ----------
FROM api AS runtime-api
FROM web AS runtime-office
FROM web AS runtime-marketing
FROM web AS runtime-borrower

ARG PHINDU_SERVICE=office
FROM runtime-${PHINDU_SERVICE} AS runtime
