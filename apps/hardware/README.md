# Hardware workspace

Phase 4 is now scaffolded with a PlatformIO environment, a non-blocking Wi-Fi
reconnect loop, thermistor and vibration sampling, and HTTP telemetry posting to
the FastAPI backend.

## Wiring plan (Phase 4)

The default firmware targets a **classic ESP32 DevKit**.

- Thermistor divider on ADC1 `GPIO34`
- Conditioned vibration signal on ADC1 `GPIO35`
- 10 kOhm series resistor for a 10 kOhm NTC thermistor divider
- 3.3 V logic and a shared ground across the ESP32 and sensor breakouts

ADC1 avoids Wi-Fi/ADC2 conflicts. A raw piezo element still needs input
protection and signal conditioning before connection to an ADC input.

## Firmware configuration

1. Copy `include/workvision_config.example.h` to `include/workvision_config.h`.
2. Fill in the Wi-Fi credentials, backend base URL, node ID, and bearer token.
3. Flash the board with PlatformIO.

The firmware publishes approximately every 500 ms and never blocks the main loop
waiting for Wi-Fi reconnection.

## Backend contract

The node posts JSON to `POST /v1/telemetry/hardware` with `Authorization: Bearer <token>`.

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
