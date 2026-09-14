#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <math.h>
#include <time.h>

#if __has_include("vigil_os_config.h")
#include "vigil_os_config.h"
#else
#include "vigil_os_config.example.h"
#endif

namespace {

struct TelemetrySample {
  float temperature_c;
  float vibration_rms;
  unsigned long timestamp;
};

unsigned long last_wifi_attempt_ms = 0;
unsigned long last_telemetry_ms = 0;
unsigned long last_clock_sync_ms = 0;

String telemetryEndpoint() {
  return String(vigil_os::API_BASE_URL) + "/v1/telemetry/hardware";
}

void beginWifiAttempt() {
  last_wifi_attempt_ms = millis();
  WiFi.disconnect(false, true);
  WiFi.begin(vigil_os::WIFI_SSID, vigil_os::WIFI_PASSWORD);
  Serial.printf("wifi state=reconnecting ssid=%s\n", vigil_os::WIFI_SSID);
}

void ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  if (millis() - last_wifi_attempt_ms < vigil_os::WIFI_RECONNECT_INTERVAL_MS) {
    return;
  }
  beginWifiAttempt();
}

void syncClockIfNeeded() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  if (millis() - last_clock_sync_ms < 60000UL) {
    return;
  }
  last_clock_sync_ms = millis();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

unsigned long currentTimestamp() {
  time_t now = time(nullptr);
  if (now > 1700000000) {
    return static_cast<unsigned long>(now);
  }
  return millis() / 1000UL;
}

float readThermistorCelsius() {
  int raw = analogRead(vigil_os::THERMISTOR_PIN);
  raw = constrain(raw, 1, vigil_os::ADC_MAX_READING - 1);

  float divider_ratio = static_cast<float>(vigil_os::ADC_MAX_READING) / static_cast<float>(raw) - 1.0f;
  float resistance_ohms = vigil_os::SERIES_RESISTOR_OHMS / divider_ratio;

  float steinhart = resistance_ohms / vigil_os::THERMISTOR_NOMINAL_OHMS;
  steinhart = log(steinhart);
  steinhart /= vigil_os::THERMISTOR_BETA;
  steinhart += 1.0f / (vigil_os::THERMISTOR_NOMINAL_CELSIUS + 273.15f);
  steinhart = 1.0f / steinhart;
  return steinhart - 273.15f;
}

float readVibrationRms() {
  double sum_squares = 0.0;
  constexpr float midpoint = vigil_os::ADC_MAX_READING / 2.0f;

  for (int i = 0; i < vigil_os::VIBRATION_SAMPLE_COUNT; ++i) {
    float centered = static_cast<float>(analogRead(vigil_os::VIBRATION_PIN)) - midpoint;
    sum_squares += centered * centered;
    delayMicroseconds(vigil_os::VIBRATION_SAMPLE_DELAY_US);
  }

  float rms_counts = sqrt(sum_squares / static_cast<double>(vigil_os::VIBRATION_SAMPLE_COUNT));
  return rms_counts / midpoint;
}

TelemetrySample sampleTelemetry() {
  TelemetrySample sample{};
  sample.temperature_c = readThermistorCelsius();
  sample.vibration_rms = readVibrationRms();
  sample.timestamp = currentTimestamp();
  return sample;
}

String serializeTelemetry(const TelemetrySample& sample) {
  StaticJsonDocument<256> document;
  document["client_type"] = "machine_node";
  document["node_id"] = vigil_os::NODE_ID;
  document["timestamp"] = sample.timestamp;

  JsonObject metrics = document.createNestedObject("metrics");
  metrics["temperature_c"] = sample.temperature_c;
  metrics["vibration_rms"] = sample.vibration_rms;

  String payload;
  serializeJson(document, payload);
  return payload;
}

void publishTelemetry(const TelemetrySample& sample) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, telemetryEndpoint())) {
    Serial.println("telemetry state=request_build_failed");
    return;
  }

  http.setConnectTimeout(vigil_os::HTTP_TIMEOUT_MS);
  http.setTimeout(vigil_os::HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + vigil_os::HARDWARE_TOKEN);

  String payload = serializeTelemetry(sample);
  int status_code = http.POST(payload);
  if (status_code >= 200 && status_code < 300) {
    Serial.printf(
        "telemetry state=accepted node_id=%s temperature_c=%.2f vibration_rms=%.4f\n",
        vigil_os::NODE_ID,
        sample.temperature_c,
        sample.vibration_rms);
  } else {
    Serial.printf("telemetry state=failed status_code=%d body=%s\n", status_code,
                  http.getString().c_str());
  }

  http.end();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  analogReadResolution(12);
  analogSetPinAttenuation(vigil_os::THERMISTOR_PIN, ADC_11db);
  analogSetPinAttenuation(vigil_os::VIBRATION_PIN, ADC_11db);

  Serial.printf("boot node_id=%s endpoint=%s\n", vigil_os::NODE_ID, telemetryEndpoint().c_str());
  beginWifiAttempt();
}

void loop() {
  ensureWifiConnected();
  syncClockIfNeeded();

  if (millis() - last_telemetry_ms >= vigil_os::TELEMETRY_INTERVAL_MS) {
    last_telemetry_ms = millis();
    publishTelemetry(sampleTelemetry());
  }

  delay(5);
}
