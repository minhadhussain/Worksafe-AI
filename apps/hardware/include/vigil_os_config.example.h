#pragma once

namespace vigil_os {

constexpr char WIFI_SSID[] = "replace-with-wifi-ssid";
constexpr char WIFI_PASSWORD[] = "replace-with-wifi-password";

// Use the FastAPI host reachable by the ESP32 on the local network.
constexpr char API_BASE_URL[] = "http://192.168.1.50:8000";
constexpr char HARDWARE_TOKEN[] = "dev_device_machine_001";
constexpr char NODE_ID[] = "M-EXTRUDER-1";

constexpr int THERMISTOR_PIN = 34;
constexpr int VIBRATION_PIN = 35;

constexpr float ADC_REFERENCE_VOLTAGE = 3.3f;
constexpr int ADC_MAX_READING = 4095;
constexpr float SERIES_RESISTOR_OHMS = 10000.0f;
constexpr float THERMISTOR_NOMINAL_OHMS = 10000.0f;
constexpr float THERMISTOR_NOMINAL_CELSIUS = 25.0f;
constexpr float THERMISTOR_BETA = 3950.0f;

constexpr unsigned long TELEMETRY_INTERVAL_MS = 500;
constexpr unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr unsigned long HTTP_TIMEOUT_MS = 2500;
constexpr int VIBRATION_SAMPLE_COUNT = 64;
constexpr int VIBRATION_SAMPLE_DELAY_US = 250;

}  // namespace vigil_os
