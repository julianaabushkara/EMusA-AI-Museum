#include <WiFi.h> 
#include <HTTPClient.h>

// ---- Pins ----
const int SW_PINS[4] = {14, 27, 26, 13};   // Microswitches
const int TRIG_PIN   = 32;
const int ECHO_PIN   = 33;

// ---- Switch logic ----
// If wired COM->GND and NO->GPIO with INPUT_PULLUP: pressed is LOW => true
// If you used NC instead of NO: pressed is HIGH => set false
const bool PRESSED_IS_LOW = false;
// ---- WiFi ---
const char* SSID      = "**";
const char* PASSWORD  = "**";

// ---- Backend ----
const char* BACKEND_URL = "http://ipv4:8000/esp-event";

// ---- Proximity ----
const int NEAR_ON_CM   = 60;
const int MIN_VALID_CM = 2;
const int MAX_VALID_CM = 250;

// ---- Timing ----
const unsigned long DEBOUNCE_MS = 25;
const unsigned long LOOP_DELAY_MS = 20;
const unsigned long SEND_COOLDOWN_MS = 250;

// ---- State ----
bool inProximity = false;
unsigned long lastSendMs = 0;

int stableState[4] = {0,0,0,0};   // 0=present, 1=lifted
int lastRaw[4] = {0,0,0,0};
unsigned long lastChangeMs[4] = {0,0,0,0};

int lastLiftedItem = -1;     // -1=none, -2=multi
bool lastWasMulti = false;   // for multi transition detection

unsigned long nowMs() { return millis(); }
bool canSend() { return (nowMs() - lastSendMs) > SEND_COOLDOWN_MS; }

// ---- HTTP ----
void postJSON(const String& json) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(1500);
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(json);
  Serial.printf("POST %s => %d  %s\n", BACKEND_URL, code, json.c_str());

  http.end();

  // ✅ Only start cooldown if the POST actually happened
  if (code > 0) lastSendMs = nowMs();
}

void sendEvent(const char* type) {
  postJSON(String("{\"event_type\":\"") + type + "\"}");
}

void sendItemEvent(int idx) {
  postJSON(String("{\"event_type\":\"item\",\"item_index\":") + idx + "}");
}

void sendMultiItemEvent() {
  postJSON("{\"event_type\":\"item\",\"multi\":true}");
}

// ---- Ultrasonic ----
int measureOnceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  if (us == 0) return -1;

  int cm = us / 58.0f;
  if (cm < MIN_VALID_CM) cm = MIN_VALID_CM;
  if (cm > MAX_VALID_CM) cm = MAX_VALID_CM;
  return cm;
}

int measureDistanceCM() {
  int vals[5], n = 0;
  for (int i = 0; i < 5; i++) {
    int v = measureOnceCM();
    if (v > 0) vals[n++] = v;
    delayMicroseconds(800);
  }
  if (n < 3) return -1;

  for (int i = 1; i < n; i++) {
    int k = vals[i], j = i - 1;
    while (j >= 0 && vals[j] > k) { vals[j+1] = vals[j]; j--; }
    vals[j+1] = k;
  }
  return vals[n/2];
}

// ---- Switch update + debounce ----
int readPressed(int pin) {
  int raw = digitalRead(pin); // LOW/HIGH
  if (PRESSED_IS_LOW) return (raw == LOW) ? 1 : 0;
  else               return (raw == HIGH) ? 1 : 0;
}

void updateSwitches() {
  unsigned long t = nowMs();

  for (int i = 0; i < 4; i++) {
    int rawPressed = readPressed(SW_PINS[i]);

    if (rawPressed != lastRaw[i]) {
      lastRaw[i] = rawPressed;
      lastChangeMs[i] = t;
    }

    if ((t - lastChangeMs[i]) >= DEBOUNCE_MS && rawPressed != stableState[i]) {
      stableState[i] = rawPressed;
      Serial.printf("[SW] %d -> %s\n", i+1, stableState[i] ? "LIFTED" : "PRESENT");
    }
  }
}

void getLiftState(int &liftedCount, int &singleIdx) {
  liftedCount = 0;
  singleIdx = -1;

  for (int i = 0; i < 4; i++) {
    if (stableState[i] == 1) {
      liftedCount++;
      singleIdx = i;
    }
  }
}

// ---- Setup ----
void setup() {
  Serial.begin(115200);
  delay(200);

  for (int i = 0; i < 4; i++) {
    pinMode(SW_PINS[i], INPUT_PULLUP);

    int pressed = readPressed(SW_PINS[i]);
    stableState[i] = pressed;
    lastRaw[i] = pressed;
    lastChangeMs[i] = nowMs();
  }

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
 // WiFi.begin(SSID);
  WiFi.begin(SSID, PASSWORD);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" connected");
  Serial.println("ESP ready (microswitch mode).");
}

// ---- Loop ----
void loop() {
  static int nearCount = 0;
  int cm = measureDistanceCM();

  if (cm > 0) {
    if (cm < NEAR_ON_CM) nearCount++;
    else if (nearCount) nearCount--;

    if (!inProximity && nearCount >= 3 && canSend()) {
    //if (!inProximity && nearCount >= 3){
      inProximity = true;
      sendEvent("proximity");
      nearCount = 0;

      // ✅ Sync “last” state to current reality to avoid fake MULTI on entry
      updateSwitches();
      int c = 0, idx = -1;
      getLiftState(c, idx);
      lastWasMulti = (c > 1);
      lastLiftedItem = (c == 1) ? idx : (c > 1 ? -2 : -1);
    }
  }

  if (inProximity) {
    updateSwitches();

    int liftedCount = 0, idx = -1;
    getLiftState(liftedCount, idx);

    bool isMulti = (liftedCount > 1);

    // 🔴 MULTI: only when we ENTER multi
    if (isMulti && !lastWasMulti && canSend()) {
      sendMultiItemEvent();
      Serial.println("[MULTI] Multiple items lifted");
    }

    // 🟢 SINGLE
    if (!isMulti && liftedCount == 1 && idx != lastLiftedItem && canSend()) {
      sendItemEvent(idx);
      Serial.printf("[ITEM] Item %d lifted\n", idx);
    }

    // 🔁 RESET
    if (liftedCount == 0 && lastLiftedItem != -1 && canSend()) {
      sendItemEvent(-1);
      Serial.println("[RESET] All items returned");
    }

    lastWasMulti = isMulti;
    lastLiftedItem = isMulti ? -2 : (liftedCount == 1 ? idx : -1);
  }

  delay(LOOP_DELAY_MS);
}