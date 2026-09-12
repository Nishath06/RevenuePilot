# ─────────────────────────────────────────────────────────────────────────────
# RevenuePilot Store Frontend — Production Dockerfile
# Stage 1: Build React/Vite Store SPA with Node 22 Alpine
# Stage 2: Serve compiled static assets with Nginx 1.29 Alpine
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy package manifests for layer caching
COPY package*.json ./

# Clean installation of dependencies
RUN npm ci

# Copy application source code & build production bundle
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:1.29-alpine AS runtime

LABEL maintainer="RevenuePilot Team" \
      version="1.0.0" \
      description="RevenuePilot Store Customer Frontend"

# Upgrade Alpine OS packages to patch vulnerabilities (util-linux, libuuid, etc.)
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Copy compiled static SPA assets from builder
COPY --from=build /app/dist /usr/share/nginx/html

# Custom Nginx configuration with SPA routing and backend proxying
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    # Serve React SPA
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy Store Backend API → store-backend:8000
    location /api {
        proxy_pass http://store-backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF

EXPOSE 80

# Healthcheck to verify Nginx status
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
