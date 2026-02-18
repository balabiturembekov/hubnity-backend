# HTTPS Setup — Nginx Proxy Manager + Let's Encrypt

Domains: **hubnity.io**, **hubnity.eu**  
Server IP: **87.106.189.11**

## 1. Prerequisites

- Ports **80**, **443**, **81** free on the host
- DNS A records pointing to `87.106.189.11`:
  - `api.hubnity.io`
  - `s3.hubnity.io`
  - `hubnity.eu` (frontend)

## 2. Start NPM + Minio

```bash
cd /path/to/hubnity-backend

# Start all services including NPM and Minio
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.npm.yml up -d

# Verify
docker compose ps
```

## 3. Nginx Proxy Manager — Initial Login

1. Open **http://87.106.189.11:81**
2. Default credentials:
   - **Email:** `admin@example.com`
   - **Password:** `changeme`
3. Change password immediately.

## 4. Proxy Hosts — SSL Certificates

### 4.1 api.hubnity.io → Backend

1. **Hosts** → **Proxy Hosts** → **Add Proxy Host**
2. **Details:**
   - **Domain Names:** `api.hubnity.io`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `nginx` (Docker service name)
   - **Forward Port:** `80`
   - **Cache Assets:** off (optional)
   - **Block Common Exploits:** on
3. **SSL:**
   - **SSL Certificate:** Request a new Let's Encrypt Certificate
   - **Force SSL:** on
   - **HTTP/2 Support:** on
   - **Email:** your-email@hubnity.io (for Let's Encrypt)
4. **Custom Nginx Configuration** (optional, for large uploads):
   ```nginx
   client_max_body_size 50M;
   proxy_read_timeout 60s;
   proxy_send_timeout 60s;
   ```
5. Save.

### 4.2 s3.hubnity.io → Minio

1. **Add Proxy Host**
2. **Details:**
   - **Domain Names:** `s3.hubnity.io`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `minio`
   - **Forward Port:** `9000`
3. **SSL:** Same as above — Request Let's Encrypt, Force SSL.
4. **Custom Nginx Configuration** (for S3/Minio):
   ```nginx
   client_max_body_size 100M;
   proxy_buffering off;
   proxy_request_buffering off;
   proxy_http_version 1.1;
   proxy_set_header Connection "";
   chunked_transfer_encoding off;
   ```
5. Save.

### 4.3 hubnity.eu → Frontend

If you have a frontend container (e.g. `frontend` on port 3000):

1. **Add Proxy Host**
2. **Details:**
   - **Domain Names:** `hubnity.eu`, `www.hubnity.eu`
   - **Forward Hostname / IP:** `frontend`
   - **Forward Port:** `3000`
3. **SSL:** Request Let's Encrypt, Force SSL.

If the frontend runs **outside Docker** (e.g. on the host):

- **Forward Hostname / IP:** `host.docker.internal` (Linux: use host IP or `172.17.0.1`)
- **Forward Port:** your frontend port

## 5. SSL Certificate — Let's Encrypt

1. In each Proxy Host, open **SSL** tab.
2. **SSL Certificate:** Request a new Let's Encrypt Certificate.
3. **Email Address for Let's Encrypt:** your-email@hubnity.io
4. **I Agree to the Let's Encrypt Terms of Service:** ✓
5. **Use a DNS Challenge:** off (unless using wildcard `*.hubnity.io`)
6. Save — NPM will request the certificate automatically.

**Troubleshooting:**

- **Port 80 must be reachable** from the internet for HTTP-01 challenge.
- If behind a firewall, open ports 80 and 443.
- Certificates renew automatically (NPM handles this).

## 6. CORS — Backend Configuration

Update `.env` (or `.env.production`):

```env
# CORS — allow frontend and S3 domains
FRONTEND_URL=https://hubnity.eu
ALLOWED_ORIGINS=https://hubnity.eu,https://hubnity.io,https://api.hubnity.io,https://s3.hubnity.io,tauri://localhost,http://tauri.localhost
```

For Tauri desktop app, keep `tauri://localhost` and `http://tauri.localhost` in `ALLOWED_ORIGINS`.

Restart backend after changing env:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.npm.yml up -d --force-recreate backend
```

## 7. S3 / Minio — Backend Configuration

`docker-compose.npm.yml` injects S3 env into the backend. In `.env`:

```env
# Minio credentials (must match MINIO_ROOT_USER / MINIO_ROOT_PASSWORD in compose)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# Backend uses these for S3 (injected by docker-compose.npm.yml)
S3_BUCKET=hubnity-screenshots
S3_PUBLIC_BASE_URL=https://s3.hubnity.io/hubnity-screenshots
```

Backend connects to Minio internally via `http://minio:9000`. Public screenshot URLs use `S3_PUBLIC_BASE_URL`.

## 8. Verify

```bash
# API
curl -I https://api.hubnity.io/api/v1/

# S3 (Minio)
curl -I https://s3.hubnity.io/minio/health/live
```

## 9. Architecture

```
Internet (HTTPS)
       │
       ▼
NPM (80/443) — SSL termination
       │
       ├── api.hubnity.io  → nginx:80 → backend:3001
       ├── s3.hubnity.io   → minio:9000
       └── hubnity.eu      → frontend:3000 (or host)
```
