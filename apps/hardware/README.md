# Hardware workspace

ESP32 firmware is scheduled for Phase 4. Phase 1 reserves both `src/` and
`platformio.ini` so the monorepo already matches the target workspace
structure.

## Wiring plan (Phase 4)

The exact board, thermistor resistance, divider resistor, and vibration sensor
must be selected before finalizing wiring or conversion formulas. Suggested
ADC1 inputs on a **classic ESP32 DevKit** are GPIO34 for the thermistor divider
and GPIO35 for a conditioned vibration signal. ADC1 avoids Wi-Fi/ADC2 conflicts.
Use 3.3 V logic and a common ground; a raw piezo needs input protection and signal
conditioning before connection to an ADC.

These are provisional pin assignments, not working firmware. The eventual loop
must reconnect Wi-Fi without blocking and publish telemetry at approximately 2 Hz.
