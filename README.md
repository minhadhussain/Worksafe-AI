# Vigil OS

Phase 1 through Phase 4 implementation for the vision-first industrial safety MVP described in `docs/vigil_os_full.md`.

## Architecture Overview

The repository is a small monorepo with one web application, one API service, and a reserved hardware workspace:

```text
  apps/
    admin/      Next.js admin/supervisor application
    api/        FastAPI service, health checks, Redis connectivity, future vision/telemetry endpoints
    hardware/   Reserved ESP32 workspace for Phase 4 firmware
    worker/     Next.js worker/mobile application
  shared/       Shared frontend UI primitives and helpers used by both apps
infra/
  caddy/      Local HTTPS reverse proxy for browser secure-context testing
```

Current implemented scope:

- Separate Next.js admin and worker applications
- Mobile worker client with DeviceMotion, Geolocation, Wake Lock, and WebSocket telemetry streaming
- FastAPI foundation with health/readiness endpoints and explicit CORS configuration
- FastAPI vision frame ingestion with OpenCV annotation and YOLOv8 model loading
- FastAPI admin WebSocket route for real-time worker and vision events
- Hardware telemetry ingestion for ESP32 nodes with token-authenticated HTTP posts
- ESP32 firmware scaffold with non-blocking Wi-Fi reconnects, thermistor reads, vibration sampling, and telemetry publishing
- Docker Compose stack for `gateway`, `web`, `api`, and `redis`
- Local HTTPS entrypoint on `https://localhost:8443` for browser APIs that require a secure context

## Services

- `gateway`: Caddy reverse proxy with local TLS termination
- `web`: Next.js standalone production build
- `api`: FastAPI service with Redis-backed readiness checks, vision processing, and hardware telemetry ingestion
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

The Next.js UI exposes a live infrastructure status card, and the worker page can now request sensor permissions and stream telemetry over WebSockets from the required `Start Shift` click.

## Vision Model Setup

Phase 3 expects a trained YOLOv8 weight file in `apps/api/ml_models/vigil-os-ppe.pt` by default.

- Supported ingest route: `POST /v1/vision/frame`
- Request body: JSON with `camera_id`, `frame_base64`, and optional `annotate`
- Response body: detections, missing PPE classes inferred from the frame, and an annotated JPEG frame encoded as base64

The API loads the model during startup. In `production`, startup fails if the model cannot be loaded. In `development` and `test`, the API stays up and the vision route returns a structured `503` until weights and runtime dependencies are available.

## Worker Telemetry Setup

Phase 2 uses the mobile worker page at `/worker`.

- Worker WebSocket route: `GET /ws/telemetry/worker/{worker_id}?token=...`
- Admin alert stream: `GET /ws/admin/alerts`
- Browser payload shape: `client_type`, `worker_id`, `timestamp`, `motion`, and optional `location`

Relevant environment variables:

- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_WORKER_ID`
- `NEXT_PUBLIC_WORKER_TOKEN`
- `WORKER_API_TOKENS`
- `WORKER_TELEMETRY_TTL_SECONDS`

If GPS is denied, the worker client stays connected and the backend falls back to the logical zone label `Unknown Zone`.

## Admin Login Setup

The public landing page now links `Admin Login` to `/admin-login`.

Server-side environment variables:

- `ADMIN_LOGIN_IDENTIFIER`
- `ADMIN_LOGIN_PASSCODE`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ADMIN_LOGIN_TABLE`

The login route expects a Supabase table with at least these columns:

- `identifier` text
- `status` text
- `source` text
- `user_agent` text nullable
- `ip_address` text nullable
- `created_at` timestamptz default `now()`

The route validates the configured username and passcode, attempts to store each login attempt in Supabase, then redirects successful logins to `/dashboard`.

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

The Phase 4 hardware workspace now includes a real PlatformIO configuration and an ESP32 firmware entrypoint.

Recommended provisional wiring on a classic ESP32 DevKit:

- Thermistor divider to ADC1 `GPIO34`
- Conditioned vibration signal to ADC1 `GPIO35`
- Common ground across the ESP32 and sensor breakout
- 3.3 V logic only

Raw piezo elements need protection and conditioning before they are connected to an ADC input.

## Hardware Node Setup

The ESP32 firmware publishes telemetry every 500 ms to `POST /v1/telemetry/hardware`.

1. Copy `apps/hardware/include/vigil_os_config.example.h` to `apps/hardware/include/vigil_os_config.h`.
2. Fill in the Wi-Fi credentials, API base URL, node ID, and bearer token.
3. Flash the board with PlatformIO.

Telemetry payload shape:

```json
{
  "client_type": "machine_node",
  "node_id": "M-EXTRUDER-1",
  "timestamp": 1718362912,
  "metrics": {
    "temperature_c": 72.4,
    "vibration_rms": 14.2
  }
}
```

Authentication uses `Authorization: Bearer <token>` and the API buffers the last known hardware state in Redis.

## Development Checks

Admin:

```bash
cd apps/admin
npm run lint
npm run build
```

Worker:

```bash
cd apps/worker
npm run lint
npm run build
```

API:

```bash
cd apps/api
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

Hardware:

```bash
platformio run -d apps/hardware
```

## Phase Boundaries

Still intentionally deferred:

- Alert routing, heatmaps, or live dashboard event streams

Those remain intentionally deferred to later phases from the specification.
