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
- Mobile worker client with motion-only fall detection and acknowledged HTTP reports
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

The existing admin CCTV panels consume continuous annotated MJPEG streams from FastAPI.
The worker uses DeviceMotion only, and sends fall/resolve reports over HTTP.

## Vision Model Setup

The API loads `apps/api/models/best.pt` once on startup. It starts two processors automatically:

- `CAM-LEFT`: `apps/api/videos/testleft.mp4`
- `CAM-RIGHT`: `apps/api/videos/testright.mp4`

Frames are read individually, resized to fit 640×384 with the aspect ratio preserved,
and inferred with class IDs resolved from the model's names. Only Person, Hardhat,
NO-Hardhat, Safety Vest, and NO-Safety Vest are surfaced. The original weights and
videos are not modified. EOF rewinds to frame zero. Each camera retains just its
latest JPEG and metadata; clients share that result instead of creating inference jobs.

Seven consecutive positive frames activate one incident per camera/violation type;
seven consecutive clear frames resolve it. Camera failures are not clear evidence.
Active and resolved incidents live in memory and reset when the API restarts.
Resolved history is bounded to 1,000 records. Run **one API worker** for this demo.

Current endpoints:

- `GET /health`: model and camera startup/availability status
- `GET /api/cameras`, `GET /api/cameras/{camera_id}`
- `GET /api/cameras/CAM-LEFT/stream`, `GET /api/cameras/CAM-RIGHT/stream`
- `GET /api/admin/incidents`, `GET /api/admin/workers`
- `/ws/admin`: initial snapshot, camera updates, incident creation/resolution, worker updates

The existing `/health/live`, `/health/ready`, `/v1`, hardware ingestion, and legacy
WebSocket routes remain available. `/health/ready` continues to check Redis.

- Supported ingest route: `POST /v1/vision/frame`
- Request body: JSON with `camera_id`, `frame_base64`, and optional `annotate`
- Response body: detections, missing PPE classes inferred from the frame, and an annotated JPEG frame encoded as base64

If a model/video is missing or inference fails, the affected camera reports ERROR and its
stream returns 503 until it recovers. The API and the other camera continue running.
The admin displays unavailable/unknown states instead of mock detections. Camera counts
are anonymous model observations, not identities; worker records come from actual reports.

### Local run (PowerShell, three terminals)

From `apps/api`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Use the existing `main:app` entry point (this repository has no `app.main` module).
The CPU-only install avoids downloading CUDA dependencies for the laptop demo.
In separate terminals run `npm run admin:dev` and `npm run worker:dev` from the root.
Both frontends use their own `.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
The root `.env` controls API settings; set `VISION_MODEL_WEIGHTS=apps/api/models/best.pt`.

After both cameras complete a loop, verify the actual running pipeline from `apps/api`:

```powershell
.\.venv\Scripts\python.exe scripts/verify_live_system.py
```

## Worker Telemetry Setup

The worker portal is `http://localhost:3001` (the existing `/worker` route also remains).

- `START SAFETY MONITORING` requests motion permission directly from the tap.
- `POST /api/worker/fall`: `{worker_id, event_id, timestamp, accel_g}`
- `POST /api/worker/fall/resolve`: `{worker_id, incident_id}`
- Both use `Authorization: Bearer <worker token>`.
- A 2.5g impact triggers a potential fall report. One outstanding report is latched until resolution.
- Retries reuse the same event ID; the API deduplicates reports and rejects stale resolutions.
- Delivery is shown as successful only after an HTTP acknowledgment. Failed reports have a retry action.
- No worker WebSocket, GPS, camera, microphone, or location permission is used.

Relevant environment variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WORKER_ID`
- `NEXT_PUBLIC_WORKER_TOKEN`
- `WORKER_API_TOKENS`

Keep the worker page foregrounded: browsers may suspend motion events in the background.
For a phone demo, run `ngrok http 8000`, set the deployed worker's
`NEXT_PUBLIC_API_BASE_URL` to that HTTPS tunnel URL, and redeploy. Add the exact worker
origin to the API's `CORS_ORIGINS` JSON array and restart the API. The model and videos
remain on the laptop. Localhost on the phone is not the laptop.

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

- Persistent incident storage, facility heatmaps, and production account management

Those remain intentionally deferred to later phases from the specification.
