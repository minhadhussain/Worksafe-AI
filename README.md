# WorkVision

Phase 1 foundation for the vision-first industrial safety MVP described in `docs/workvision_full.md`.

## Architecture Overview

The repository is a small monorepo with one web application, one API service, and a reserved hardware workspace:

```text
apps/
  api/        FastAPI service, health checks, Redis connectivity, future vision/telemetry endpoints
  hardware/   Reserved ESP32 workspace for Phase 4 firmware
  web/        Next.js unified web application with admin and worker entry views
infra/
  caddy/      Local HTTPS reverse proxy for browser secure-context testing
```

Current Phase 1 scope:

- Next.js application shell for admin and worker routes
- FastAPI foundation with health/readiness endpoints and explicit CORS configuration
- Docker Compose stack for `gateway`, `web`, `api`, and `redis`
- Local HTTPS entrypoint on `https://localhost:8443` for browser APIs that require a secure context

## Services

- `gateway`: Caddy reverse proxy with local TLS termination
- `web`: Next.js standalone production build
- `api`: FastAPI service with Redis-backed readiness checks
- `redis`: message broker and low-latency state store for later phases

Primary URLs after `docker compose up --build`:

- Web over HTTPS: `https://localhost:8443`
- Web over HTTP: `http://localhost:3000`
- API direct: `http://localhost:8000`
- Redis direct: `redis://localhost:6379/0`

## Docker Startup

1. Copy `.env.example` to `.env` and adjust values only if needed.
2. Start the stack:

```bash
docker compose up --build
```

3. Verify the services:

```bash
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

The Next.js UI exposes a live infrastructure status card, and the worker page keeps the required `Start Shift` entrypoint ready for Phase 2 sensor permissions.

## HTTPS And Local SSL

Phase 2 device sensors need a secure context. Phase 1 now includes a local TLS gateway:

- `http://localhost:8080` redirects to `https://localhost:8443`
- `https://localhost:8443` proxies web traffic to Next.js and API traffic to FastAPI
- API paths proxied through the gateway: `/health/*`, `/v1/*`, `/docs`, `/openapi.json`, `/redoc`, `/ws/*`

Notes:

- Desktop browsers already treat `localhost` as a secure context, but the HTTPS gateway keeps the stack aligned with the later mobile/browser API requirements.
- The Caddy certificate is locally issued. For trusted HTTPS in a real phone demo, use a tunnel such as `ngrok`, `localtunnel`, or `Tailscale Funnel`, then add the public origin to `CORS_ORIGINS`.
- Do not rely on `http://192.168.x.x` for DeviceMotion or Geolocation permission flows on mobile browsers.

## Hardware Wiring

The hardware implementation is intentionally deferred to Phase 4, but the repository already reserves the ESP32 workspace.

Recommended provisional wiring on a classic ESP32 DevKit:

- Thermistor divider to ADC1 `GPIO34`
- Conditioned vibration signal to ADC1 `GPIO35`
- Common ground across the ESP32 and sensor breakout
- 3.3 V logic only

Raw piezo elements need protection and conditioning before they are connected to an ADC input.

## Development Checks

Web:

```bash
cd apps/web
npm run lint
npm run build
```

API:

```bash
cd apps/api
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

## Phase Boundaries

Phase 1 does not include:

- DeviceMotion, Geolocation, Wake Lock, or WebSocket telemetry clients
- Vision ingestion, OpenCV processing, or YOLO inference
- ESP32 firmware logic
- Alert routing, heatmaps, or live dashboard event streams

Those remain intentionally deferred to later phases from the specification.
