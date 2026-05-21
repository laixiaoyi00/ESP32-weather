#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiManager.h> // WiFiManager by tzapu (安裝: PIO lib / Arduino Library Manager)
#include <time.h>

// ==========================================
//              用戶配置區域
// ==========================================

#define DHTPIN 4
#define DHTTYPE DHT11

// ST7735 螢幕腳位
#define TFT_CS 10
#define TFT_RST 46
#define TFT_DC 9
#define TFT_MOSI 11
#define TFT_SCLK 12
#define TFT_BLK 0 // 背光控制 (GPIO 0)

// 旋轉 / 重置按鈕腳位
//   短按 = 旋轉螢幕
//   長按 3 秒 = 清除 WiFi 設定並重啟進入配網模式
#define BUTTON_PIN 14
#define LONG_PRESS_MS 3000 // 長按判定門檻 (ms)

// WiFiManager AP 設定 (首次配網時的熱點名稱)
#define AP_NAME "WeatherStation"
#define AP_PASS "" // 留空 = 開放 AP，填入 8+ 字元可加密

// 時區
const long gmtOffset_sec = 8 * 3600;
const int daylightOffset_sec = 0;
const char *ntpServer = "pool.ntp.org";

// ThingSpeak 配置
#define THINGSPEAK_API_KEY "CTOUUNZZ3KHVRGJ8" // Write API Key
#define THINGSPEAK_URL "http://api.thingspeak.com/update"
unsigned long lastUploadTime = 0;
const unsigned long UPLOAD_INTERVAL = 20000; // 每 20 秒上傳一次

// ==========================================
//              物件初始化與全域變數
// ==========================================
Adafruit_ST7735 tft =
    Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);
DHT dht(DHTPIN, DHTTYPE);

float temp = 0.0;
float hum = 0.0;
unsigned long lastSensorTime = 0;

// 螢幕狀態與防彈跳
int currentRotation = 1;
int lastButtonState = HIGH;
unsigned long lastButtonTime = 0;
unsigned long buttonDownTime = 0; // 記錄按下的時刻
bool longPressHandled = false;    // 避免長按重複觸發

// 顯示緩衝 (用來強制刷新的變數)
int lastSec = -1;
int lastDay = -1;

// WiFi 重連控制
unsigned long lastReconnectTime = 0;
const unsigned long RECONNECT_INTERVAL = 10000; // 每 10 秒重連一次

// 函數宣告
void drawUI();
void updateSensorDisplay();
void updateTimeDisplay();
void handleButton();
void resetWiFiAndReboot();
void uploadToThingSpeak();

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Weather Station Starting ---");

  // 初始化按鈕
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // 初始化背光 (Output High)
  pinMode(TFT_BLK, OUTPUT);
  digitalWrite(TFT_BLK, HIGH);

  // 初始化螢幕
  Serial.println("Initializing TFT...");
  tft.initR(INITR_GREENTAB);
  tft.setRotation(currentRotation);
  tft.fillScreen(ST7735_BLACK);

  tft.setTextColor(ST7735_WHITE);
  tft.setTextSize(1);
  tft.setCursor(0, 0);
  tft.println("Booting...");

  dht.begin();

  // ==========================================
  //   WiFiManager 配網
  // ==========================================
  Serial.println("Starting WiFiManager...");
  tft.println("WiFi Setup...");

  // --- 新增：啟動時按鈕檢查 ---
  // 如果開機看到 "WiFi Setup" 時按住按鈕 2 秒，直接強制重置 WiFi
  if (digitalRead(BUTTON_PIN) == LOW) {
    unsigned long bootCheckStart = millis();
    tft.println("Hold to reset...");
    while (digitalRead(BUTTON_PIN) == LOW) {
      if (millis() - bootCheckStart > 2000) {
        resetWiFiAndReboot();
      }
      delay(10);
    }
  }

  WiFiManager wm;

  // 設定連接超時：如果 15 秒內連不上已儲存的 WiFi，就進入 AP 模式
  wm.setConnectTimeout(15);

  // 配網超時：180 秒內沒完成就重啟
  wm.setConfigPortalTimeout(180);

  // 自動連線：如果 NVS 裡有已儲存的 WiFi，直接連
  // 如果沒有（或連不上），就開 AP 讓使用者配網
  bool connected = wm.autoConnect(AP_NAME, AP_PASS);

  if (!connected) {
    Serial.println("WiFi config timeout, rebooting...");
    tft.println("Config timeout!");
    tft.println("Rebooting...");
    delay(2000);
    ESP.restart();
  }

  Serial.println("WiFi Connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  tft.println("WiFi OK");
  tft.print("IP: ");
  tft.println(WiFi.localIP());
  delay(1000);

  // Time
  Serial.println("Syncing Time...");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  tft.println("Syncing Time...");
  struct tm timeinfo;

  unsigned long startSync = millis();
  // 最多等待 15 秒同步時間，期間允許偵測按鈕（方便在同步時重置 WiFi）
  while (!getLocalTime(&timeinfo, 100)) {
    handleButton(); // 關鍵：在等待時也要能偵測按鈕

    if (millis() - startSync > 15000) {
      Serial.println("\nTime Sync Timeout!");
      tft.println("Time Sync Timeout");
      break;
    }

    tft.print(".");
    Serial.print(".");
    delay(400);
  }

  if (millis() - startSync <= 15000) {
    Serial.println("\nTime Synced!");
    tft.println("Time Ready!");
  }
  delay(1000);

  // 主畫面
  tft.fillScreen(ST7735_BLACK);
  drawUI();
}

void loop() {
  // 處理按鈕（短按旋轉 / 長按重置 WiFi）
  handleButton();

  // WiFi 保持連線
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectTime > RECONNECT_INTERVAL) {
      Serial.println("WiFi disconnected, attempting reconnect...");
      WiFi.reconnect();
      lastReconnectTime = millis();
    }
  }

  // 感測器更新 (2秒)
  if (millis() - lastSensorTime > 2000) {
    temp = dht.readTemperature();
    hum = dht.readHumidity();
    lastSensorTime = millis();
    updateSensorDisplay();
  }

  // ThingSpeak 上傳 (20秒)
  if (WiFi.status() == WL_CONNECTED &&
      millis() - lastUploadTime > UPLOAD_INTERVAL) {
    if (!isnan(temp) && !isnan(hum)) {
      uploadToThingSpeak();
    }
    lastUploadTime = millis();
  }

  // 時間更新 (1秒)
  updateTimeDisplay();

  delay(10); // 縮短延遲以增加按鈕反應靈敏度
}

// ================= 按鈕處理 =================

void handleButton() {
  int currentState = digitalRead(BUTTON_PIN);

  // --- 按下瞬間 (Falling Edge) ---
  if (currentState == LOW && lastButtonState == HIGH) {
    buttonDownTime = millis();
    longPressHandled = false;
  }

  // --- 持續按住：檢測長按 ---
  if (currentState == LOW && !longPressHandled) {
    if (millis() - buttonDownTime >= LONG_PRESS_MS) {
      longPressHandled = true;
      Serial.println("Long Press: Resetting WiFi...");
      resetWiFiAndReboot();
    }
  }

  // --- 放開瞬間 (Rising Edge)：短按 → 旋轉螢幕 ---
  if (currentState == HIGH && lastButtonState == LOW) {
    if (!longPressHandled &&
        (millis() - buttonDownTime > 50)) { // 50ms debounce
      Serial.println("Short Press: Rotating Screen...");

      currentRotation = (currentRotation + 1) % 4;
      tft.setRotation(currentRotation);
      tft.fillScreen(ST7735_BLACK);

      // 重置顯示狀態以強制全畫重繪
      lastSec = -1;
      lastDay = -1;
      lastSensorTime = 0;

      drawUI();
    }
  }

  lastButtonState = currentState;
}

// ================= WiFi 重置 =================

void resetWiFiAndReboot() {
  tft.fillScreen(ST7735_BLACK);
  tft.setTextColor(ST7735_RED);
  tft.setTextSize(1);
  tft.setCursor(10, 40);
  tft.println("WiFi Reset!");
  tft.setCursor(10, 55);
  tft.println("Rebooting to");
  tft.setCursor(10, 65);
  tft.println("config mode...");

  Serial.println("Erasing WiFi credentials from NVS...");

  // 清除 WiFiManager 儲存的 WiFi 設定
  WiFiManager wm;
  wm.resetSettings();

  delay(2000);
  ESP.restart();
}

// ================= ThingSpeak 上傳 =================

void uploadToThingSpeak() {
  HTTPClient http;
  String url = String(THINGSPEAK_URL) + "?api_key=" + THINGSPEAK_API_KEY +
               "&field1=" + String(temp, 1) + "&field2=" + String(hum, 1);

  http.begin(url);
  http.setTimeout(10000); // 10 秒超時
  int httpCode = http.GET();

  if (httpCode > 0) {
    Serial.printf("ThingSpeak upload OK: %d (entry: %s)\n", httpCode,
                  http.getString().c_str());
  } else {
    Serial.printf("ThingSpeak upload FAILED: %s\n",
                  http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ================= UI 繪製函數 =================

void drawUI() {
  tft.setTextColor(ST7735_CYAN);
  tft.setTextSize(1);
  tft.setCursor(10, 5);
  tft.print("Weather Station");

  // 根據旋轉方向調整線段寬度 (簡單處理)
  int w = (currentRotation % 2 == 0) ? 128 : 160;
  tft.drawFastHLine(0, 18, w, ST7735_WHITE);

  tft.setCursor(5, 50);
  tft.setTextColor(ST7735_YELLOW);
  tft.print("Temp:");

  tft.setCursor(85, 50);
  tft.setTextColor(ST7735_BLUE);
  tft.print("Hum:");
}

void updateSensorDisplay() {
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Sensor read failed!");
    return;
  }

  tft.setCursor(5, 65);
  tft.setTextColor(ST7735_WHITE, ST7735_BLACK);
  tft.setTextSize(2);
  tft.print((int)temp);
  tft.setTextSize(1);
  tft.print(" C");

  tft.setCursor(85, 65);
  tft.setTextColor(ST7735_WHITE, ST7735_BLACK);
  tft.setTextSize(2);
  tft.print((int)hum);
  tft.setTextSize(1);
  tft.print(" %");
}

void updateTimeDisplay() {
  struct tm timeinfo;
  // 使用極短超時 (5ms)，如果時間未同步則不更新，避免阻塞 loop
  if (!getLocalTime(&timeinfo, 5))
    return;

  if (lastSec != timeinfo.tm_sec) {
    tft.setCursor(25, 25);
    tft.setTextColor(ST7735_GREEN, ST7735_BLACK);
    tft.setTextSize(2);

    if (timeinfo.tm_hour < 10)
      tft.print("0");
    tft.print(timeinfo.tm_hour);
    tft.print(":");
    if (timeinfo.tm_min < 10)
      tft.print("0");
    tft.print(timeinfo.tm_min);
    tft.print(":");
    if (timeinfo.tm_sec < 10)
      tft.print("0");
    tft.print(timeinfo.tm_sec);

    lastSec = timeinfo.tm_sec;
  }

  if (lastDay != timeinfo.tm_mday) {
    tft.setCursor(30, 100);
    tft.setTextColor(ST7735_MAGENTA, ST7735_BLACK);
    tft.setTextSize(1);

    tft.print(timeinfo.tm_year + 1900);
    tft.print("-");
    if (timeinfo.tm_mon + 1 < 10)
      tft.print("0");
    tft.print(timeinfo.tm_mon + 1);
    tft.print("-");
    if (timeinfo.tm_mday < 10)
      tft.print("0");
    tft.print(timeinfo.tm_mday);

    lastDay = timeinfo.tm_mday;
  }
}
