# **Vision-First Industrial Safety Platform — MVP Build Specification**

### **1\. Objective**

Build a unified AI and IoT platform that allows factory supervisors to monitor worker safety and machinery health in real-time. The platform exists to convert physical site hazards into immediate, actionable dashboard alerts. The product should NOT attempt to become a full enterprise SaaS infrastructure platform for the MVP. The MVP goal is: Worker connects phone → CCTV monitors area → hardware monitors machine → admin sees a unified, real-time safety heatmap and alert feed. The platform must integrate with existing site infrastructure (CCTV) and basic smartphones, explicitly avoiding invasive camera or microphone permissions on worker devices.

### **2\. Core Product**

The platform has three components: **Unified Web Application** Used for: Worker telemetry streaming (Mobile view) Live CCTV monitoring (Laptop/Admin view) Viewing the dynamic risk heatmap Receiving real-time hazard alerts **AI Vision Backend** Used for: Ingesting fixed CCTV video feeds Running YOLOv8 PPE detection Broadcasting alerts via WebSockets **Hardware Nodes (ESP32)** Used for: Monitoring machinery temperature Monitoring machinery vibration Streaming environmental telemetry

### **3\. Core User Journey**

**Worker / Site Flow** Worker arrives at site ↓ Opens Mobile Web App (PWA) ↓ Grants motion/location permissions (No Camera/Mic) ↓ Puts phone in pocket ↓ Walks into CCTV frame ↓ AI detects missing hardhat ↓ Admin dashboard flashes red with bounding box ↓ Phone detects sudden G-force spike (simulated fall) ↓ Admin dashboard triggers critical fall alert ↓ Hardware node detects high machine temp ↓ Dashboard Risk Heatmap updates to show a "High Risk" cluster ↓ Supervisor acts on data

Keep this journey extremely simple and optimized for a 5–7 minute live demo.

### **4\. Technology Stack**

**Frontend** Next.js TypeScript Tailwind CSS shadcn/ui HTML5 Web APIs (DeviceMotion, Geolocation) **Backend** Python FastAPI Pydantic WebSockets **AI / Vision** YOLOv8 OpenCV TensorFlow Roboflow Construction Safety Dataset **Database** Supabase PostgreSQL **Cache / Message Broker** Redis (for WebSocket pub/sub and rate limiting) **Hardware** ESP32 Microcontroller Thermistors Piezo / IMU (for vibration) **Deployment** Docker Docker Compose Initial containers: web api redis celery (optional for async vision processing)

### **5\. Repository Structure**

Use a simple monorepo:

Plaintext

project/

│

├── apps/

│   ├── web/               \# Next.js Frontend

│   │   ├── app/

│   │   ├── components/

│   │   └── ...

│   │

│   ├── api/               \# FastAPI Backend

│   │   ├── api/

│   │   ├── core/

│   │   ├── ml\_models/     \# YOLOv8 weights

│   │   ├── services/

│   │   └── main.py

│   │

│   └── hardware/          \# ESP32 Firmware

│       ├── src/

│       └── platformio.ini

│

├── docker-compose.yml

├── .env.example

└── README.md

&nbsp;

Do not introduce unnecessary microservices.

### **6\. Database Design**

Use Supabase PostgreSQL. Store coordinates as standard floats, but store sensor readings logically.

**workers**

Plaintext

id

name

status (active/inactive)

last\_known\_zone

created\_at

&nbsp;

**hardware\_nodes**

Plaintext

id

machine\_name

zone\_id

status

created\_at

&nbsp;

**hazard\_events** This is the core alerting ledger.

Plaintext

id

event\_type (PPE\_VIOLATION, FALL\_DETECTED, HIGH\_TEMP, HIGH\_VIBRATION)

source\_id (worker\_id or hardware\_id)

severity (LOW, MEDIUM, CRITICAL)

lat

lng

resolved

created\_at

&nbsp;

Never delete historical hazard events. If an event is cleared, update the `resolved` boolean.

### **7\. Telemetry Authentication**

Since this is an MVP, skip complex JWT authentication for the hardware and worker endpoints. Generate simple API tokens for the ESP32 and mobile clients to connect to the backend. Table: `client_tokens` API authentication: `Authorization: Bearer dev_device_xxxxx`

### **8\. AI Models**

The vision model must be pre-trained and loaded into memory on backend startup. Model: **YOLOv8** Dataset: **Roboflow Construction Site Safety Image Dataset** Classes to track:

* Hardhat  
* Safety Vest  
* Mask / Goggles

Do not attempt to train the model dynamically during the application runtime. Weights must be stored locally in the Docker volume or repository.

### **9\. Event Records (Telemetry Logs)**

For the MVP, keep high-frequency telemetry (accelerometer data) in memory (Redis) and only write anomalies to the PostgreSQL database. Do not write 60Hz accelerometer data directly to PostgreSQL, it will crash the DB.

### **10\. Hardware Thresholds**

Table: `alert_rules`

Plaintext

id

target\_type (temp, vibration, motion)

warning\_threshold

critical\_threshold

&nbsp;

Do not hard-code safety thresholds (e.g., "Alert at 60°C"). Make them database/config driven so they can be adjusted from the admin panel.

### **11\. Initial Setup State**

When the Next.js app boots on a mobile device, it must immediately display a "Start Shift" button. This is strictly required because browser APIs (`DeviceMotion`) require a transient user activation (a physical click) before they begin streaming data.

### **12\. Alert Routing Rules**

The alerting engine is the core safety system. When an anomaly is detected:

1. Verify it breaches the threshold.  
2. Check Redis for a recent alert from the same source (debounce).  
3. If valid, insert into `hazard_events`.  
4. Emit WebSocket event to the Admin Panel. Prevent duplicate alert spamming for a single continuous event.

### **13\. Risk Scoring (Heatmap)**

The heatmap risk score is independent of raw data. Formula conceptualization:

* PPE Violation \= \+20 risk points  
* Worker Fall \= \+50 risk points  
* High Temp \= \+30 risk points Map these points to GPS coordinates or facility zones to render the visual heatmap.

### **14\. WebSocket API**

The API should expose standard HTTP routes for config, but WebSockets for live data. `/ws/telemetry/worker/{id}` `/ws/telemetry/hardware/{id}` `/ws/admin/alerts`

### **15\. Vision Processing Flow**

Endpoint: `POST /v1/vision/frame` (or via WebRTC/WebSocket) The backend must support receiving static camera frames rapidly. Flow: Receive Frame → Run YOLO Inference → Check missing classes → Draw Bounding Box → Encode Frame to Base64 → Send via WS to Admin.

### **16\. Telemetry Request Flow**

Every hardware/worker payload follows this flow:

Plaintext

Receive WebSocket JSON

     ↓

Validate token

     ↓

Check thresholds (e.g., G-force \> 2.5)

     ↓

If safe → Update Redis last-known state

     ↓

If unsafe → Create internal Event ID

     ↓

Save to PostgreSQL hazard\_events

     ↓

Broadcast to Admin WebSocket

&nbsp;

### **17\. Disconnects & Fallbacks**

If a worker's phone disconnects: Trigger a "Signal Lost" warning on the dashboard. HTTP status: `408 Request Timeout` equivalent in WS. The dashboard should clearly show: "Worker 4 (Assembly Zone) telemetry lost."

### **18\. Zone Routing**

Initially: GPS Coordinates → Bounding Box logic → Logical Zone (e.g., "Sector A"). The admin should never need to read raw lat/lng coordinates during an emergency. The system maps coordinates to facility zones automatically.

### **19\. API Base URL**

Production API: `[https://api.YOURDOMAIN.ngrok.app/v1](https://api.YOURDOMAIN.ngrok.app/v1)` Dashboard: `[https://YOURDOMAIN.ngrok.app](https://YOURDOMAIN.ngrok.app)` Use ngrok or Tailscale for the live pitch to ensure HTTPS is active for browser APIs.

### **20\. Privacy Compatibility**

The platform must be designed strictly around privacy. Do NOT request `getUserMedia()` (camera/mic) on the Next.js mobile view. Use only: `DeviceMotionEvent` `Geolocation API` Emphasize this architectural decision during the pitch.

### **21\. Dashboard (Admin Panel)**

Keep the dashboard industrial and minimal. **Home** Show: Active Workers: 12 Active Machines: 4 System Status: Secure

**Live Vision Feed** Render the incoming Base64 CCTV frames with bounding boxes.

**Alert Feed**

Plaintext

10:42 AM \- CRITICAL \- Fall Detected (Zone 4\)

10:39 AM \- WARNING \- Missing Hardhat (Zone 1\)

10:15 AM \- WARNING \- Extruder Temp High (65°C)

&nbsp;

**Risk Heatmap** A visual grid showing red/yellow/green zones based on aggregated incidents.

### **22\. Alert Idempotency**

Sensors will send duplicate trigger thresholds (a fall might trigger 50 frames of high G-force). Therefore: `redis.setex(f"alert_lock:{worker_id}:fall", 10, "locked")` Before processing an alert, check if the lock exists. If it does, ignore it. Process it exactly once every 10 seconds.

### **23\. Hardware Integration**

Use simple JSON structures for the ESP32. Flow: Read Thermistor Read Piezo ADC Construct JSON Send to FastAPI WebSocket

### **24\. Authentication**

For MVP, do not build custom user auth. Admin panel can be unprotected or use a simple hardcoded passcode for the pitch. Focus development time on the AI and Telemetry, not login screens.

### **25\. Security**

Minimum requirements: HTTPS everywhere (strictly required for `DeviceMotion`). CORS configured explicitly. No `.env` secrets committed to Git.

### **26\. Redis**

Use Redis initially for: WebSocket Pub/Sub channel routing. Alert debouncing / idempotency locks. Storing the last-known GPS coordinates of workers.

### **27\. Rate Limiting**

Implement basic limits on telemetry. Example: Worker phone sends data at 10Hz, not 100Hz. ESP32 sends data at 2Hz. Do not flood the FastAPI backend.

### **28\. Error Handling**

Normalize sensor errors. If GPS is denied on the phone: Fall back to assigning the worker to a default "Unknown Zone" rather than crashing the mobile web app.

### **29\. Logging**

Log: `event_id` `source_id` `hazard_type` `latency` Do not log full base64 image strings to the terminal, it will freeze the console.

### **30\. Observability**

For the MVP, print statements in the FastAPI console are sufficient. Ensure you can see WebSocket connections opening and closing clearly.

### **31\. Mobile Landing Page**

Keep the mobile app page simple. Primary message: **SafeGuard Telemetry Client** Supporting message: Your privacy is protected. No camera or microphone access is required. CTA: `[ Start Shift & Connect ]`

### **32\. Setup Page (Admin)**

A hidden page to mock events. Since you can't always throw a phone on the floor during a pitch: Build a `[ Simulate Fall ]` button on the mobile UI. Build a `[ Simulate Machine Overheat ]` button on the admin UI.

### **33\. Documentation**

Create a simple `README.md`. Required sections: Architecture overview Hardware wiring (ESP32 pins) How to start Docker How to bypass HTTPS locally

### **34\. Example Mobile Payload (JSON)**

JSON

{

  "client\_type": "worker\_mobile",

  "worker\_id": "W-001",

  "timestamp": 1718362911,

  "motion": {

    "accel\_g": 3.4,

    "gyro\_rad": 0.5

  },

  "location": {

    "lat": 27.4728,

    "lng": 94.9119

  }

}

&nbsp;

### **35\. Example Hardware Payload (JSON)**

JSON

{

  "client\_type": "machine\_node",

  "node\_id": "M-EXTRUDER-1",

  "timestamp": 1718362912,

  "metrics": {

    "temperature\_c": 72.4,

    "vibration\_rms": 14.2

  }

}

&nbsp;

### **36\. Docker**

Create production Dockerfiles for: `web` `api` Example architecture:

YAML

services:

  web:

    build: ./apps/admin

    ports: \["3000:3000"\]

  api:

    build: ./apps/api

    ports: \["8000:8000"\]

  redis:

    image: redis:alpine

    ports: \["6379:6379"\]

&nbsp;

### **37\. Environment Variables**

Create `.env.example`.

Plaintext

NEXT\_PUBLIC\_WS\_URL=wss://api.yourdomain.ngrok.app

REDIS\_URL=redis://localhost:6379

DATABASE\_URL=postgresql://postgres:password@localhost:5432/safeguard

&nbsp;

Never commit `.env`.

### **38\. Testing**

Before the pitch, automated/manual tests must cover: Worker connects → Admin sees connection. Worker simulates fall → Admin sees red alert instantly. ESP32 thermistor heated with fingers → Admin sees temp warning. Person walks in front of laptop webcam without hardhat → Admin sees red bounding box. Heatmap updates dynamically based on the above events.

### **39\. Critical System Invariants**

The following must always be true: **Invariant 1:** The worker's phone MUST NOT request camera permissions. **Invariant 2:** The dashboard MUST NOT require a page refresh to show an alert. **Invariant 3:** The ESP32 MUST NOT block its main loop while waiting for WiFi. These are more important than visual polish.

### **40\. Initial Hazard Classes**

Start with a small curated list of hazards. Target:

1. Missing Hardhat  
2. Missing Vest  
3. Sudden Fall (Motion)  
4. High Temp (Machine) The system must allow these specific four to work flawlessly rather than having 20 buggy hazard detections.

### **41\. Admin Capability**

Admin should be able to: View the Risk Heatmap View the live CCTV feed View the rolling alert log Acknowledge/Dismiss alerts

### **42\. Internal Presentation Metrics**

The dashboard should eventually show: Incidents this shift Compliance percentage Most dangerous zone

### **43\. MVP Success Criteria**

The MVP is complete when the judges can see:

1. The CCTV camera feed running.  
2. A team member step in without a hardhat (red box).  
3. A team member put on a hardhat (green box).  
4. A phone shaken to simulate a fall (instant dashboard alert).  
5. The custom hardware triggered (temp/vibration alert).  
6. The Risk Heatmap turning red where those events occurred.

### **44\. Explicitly Out of Scope**

Do NOT build these for the MVP: Facial recognition (identifying *who* is missing the hardhat) Historical data charting (line graphs of past months) Complex organization management Microphone/noise anomaly detection Custom hardware PCB design (use a breadboard) If a feature does not directly help: Detect anomaly → transmit via WS → show on Heatmap/Dashboard it should probably not be built now.

### **45\. Development Order**

Phase 1 — Foundation (Next.js, FastAPI, Docker) Phase 2 — AI Vision (YOLOv8 \+ OpenCV stream) Phase 3 — Mobile Telemetry (DeviceMotion \+ WS) Phase 4 — Hardware Node (ESP32 \+ Thermistor) Phase 5 — Alerting Engine (Redis debouncing) Phase 6 — Dashboard UI (Live feed \+ alerts) Phase 7 — Risk Heatmap (Aggregating events) Phase 8 — Local Tunneling (ngrok for HTTPS) Phase 9 — Demo Mocking (Simulated buttons) Phase 10 — Pitch Rehearsal

### **46\. Launch Requirement (Demo Context)**

Before presenting, ensure you are using a secure tunneling service like `ngrok`, `localtunnel`, or `Tailscale`. Do not assume `[http://192.168.](http://192.168.)x.x` will work for the mobile app. Modern iOS/Android browsers will actively block the `DeviceMotion` API on non-HTTPS origins.

### **47\. Product Philosophy**

The implementation must follow one principle: Build the smallest possible machine that proves reactive safety is obsolete. The factory supervisor does not need: 50 complex charts. They need: Instant vision detection \+ instant hardware telemetry \+ one clear heatmap showing where the danger is. Do not over-engineer the MVP database. Ship the live WebSocket loop, trigger the events reliably, and measure how effectively the dashboard aggregates the hazards.

&nbsp;
