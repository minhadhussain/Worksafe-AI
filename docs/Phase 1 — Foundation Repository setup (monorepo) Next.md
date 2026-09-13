**Phase 1 — Foundation** Repository setup (monorepo) Next.js (Unified Web App) FastAPI (AI Backend) Docker environment configuration HTTPS/SSL setup (crucial for browser APIs)

**Phase 2 — Worker Client (Mobile Web)** Next.js mobile view DeviceMotion API integration (accelerometer/gyroscope) Geolocation API integration (GPS) WakeLock API (prevent screen sleep) WebSocket client telemetry streaming

**Phase 3 — AI Vision Backend** FastAPI video ingestion endpoint OpenCV frame processing YOLOv8 integration Load Roboflow dataset weights Bounding box drawing logic

**Phase 4 — Hardware Nodes (ESP32)** Firmware setup Wi-Fi connection loop Thermistor data reading Vibration reading (piezo or IMU) Telemetry payload transmission (WebSocket or HTTP)

**Phase 5 — Centralized Alerting Engine** Fall detection logic (G-force spikes) PPE violation logic (missing 'hardhat', 'vest') Hardware threshold logic (temp \> limit) Alert aggregation queue WebSocket broadcast to Admin Panel

**Phase 6 — Admin Panel (Dashboard UI)** Next.js desktop view layout Live video feed component Real-time streaming event log (the alert ticker) Active workers status grid Machinery status panels

**Phase 7 — Dynamic Risk Heatmap** Spatial data aggregation (GPS coordinates) Hazard clustering logic Visual color-mapping on dashboard (green to red zones) Live heatmap updates via WebSockets

**Phase 8 — System Integration** End-to-end WebSocket communication Concurrent vision \+ telemetry processing Hardware-to-backend-to-frontend loop testing

**Phase 9 — Demo Mocking & Failsafes** Simulated CCTV video loop (fallback for live webcam) Scripted hazard triggers (button to force a fall alert) Controlled location spoofing for heatmap density Simulated hardware heating (lighter/fingers on thermistor)

**Phase 10 — Production Demo Build** Local network routing (ngrok, localtunnel, or tailscale) Secure context enforcement (HTTPS) Final UI polish

&nbsp;