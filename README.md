# 🌡️ ESP32-S3 智能氣象站 (Weather Station)

這是一個基於 **ESP32-S3** 開發的智能氣象站，能夠實時監測環境溫濕度，並透過 NTP 自動同步網路時間。具備人性化的 WiFi 配網介面，無需修改程式碼即可切換網路環境。

## ✨ 特色功能

- **實時監控**：整合 DHT11 感測器，精確顯示溫度與濕度。
- **網路時鐘**：透過 NTP 獲取精準時間，支持自動更新。
- **全彩顯示**：使用 ST7735 TFT 螢幕，介面清晰美觀。
- **智慧配網 (WiFiManager)**：
  - 首次啟動或更換環境時，自動開啟 `WeatherStation` 熱點。
  - 透過手機連接熱點即可設定 WiFi 帳密，無需重新燒錄程式碼。
- **硬體交互**：
  - **短按按鈕**：切換螢幕旋轉方向（0° / 90° / 180° / 270°）。
  - **長按按鈕 (3秒)**：重置 WiFi 設定並重新進入配網模式。

## 🛠️ 硬體清單與接線 (Hardware & Wiring)

### 核心元件
- **主控板**：ESP32-S3
- **顯示器**：ST7735 TFT (128x160)
- **感測器**：DHT11 (或 DHT22)
- **按鈕**：自鎖或觸點按鈕 x1

### 詳細接線圖
| 元件 | 引腳 | ESP32-S3 腳位 (GPIO) | 備註 |
| :--- | :--- | :--- | :--- |
| **ST7735 TFT** | VCC | 3V3 | |
| | GND | GND | |
| | CS | GPIO 10 | 片選 |
| | RESET | GPIO 46 | 重置 |
| | DC | GPIO 9 | 數據/指令 |
| | SDA | GPIO 11 | MOSI |
| | SCL | GPIO 12 | SCLK |
| | BLK | GPIO 0 | 背光控制 |
| **DHT11** | VCC | 3V3 | |
| | GND | GND | |
| | DATA | GPIO 4 | 數據傳輸 |
| **按鈕** | Pin 1 | GPIO 14 | 訊號端 |
| | Pin 2 | GND | 接地端 |

## 🚀 快速開始 (Quick Start)

### 1. 安裝必要程式庫
請在 Arduino IDE 的「程式庫管理器」中搜尋並安裝以下套件：
- `WiFiManager` (by tzapu)
- `Adafruit ST7735 and ST7789 Library`
- `Adafruit GFX Library`
- `DHT sensor library` (by Adafruit)

### 2. 燒錄程式
1. 下載本專案。
2. 使用 Arduino IDE 打開 `ESP32-weather/ESP32-weather.ino`。
3. 開發板選擇 `ESP32-S3 Dev Module`。
4. 點擊「上傳」。

### 3. WiFi 配網
- 首次啟動時，螢幕會顯示 `WiFi Setup...`。
- 用手機搜尋並連線至 WiFi 熱點：`WeatherStation`。
- 在跳出的網頁中選擇您的 WiFi 並輸入密碼，儲存後裝置會自動重啟。
- **強制重置**：若需更換 WiFi，可在開機看到 `WiFi Setup` 時按住按鈕 2 秒，或在運行中長按 3 秒。

## 📄 專案結構
- `ESP32-weather/`: 包含主程式 `.ino` 檔案。
- `credentials.h`: (選用) 用於靜態帳密配置，建議使用 WiFiManager。
- `build/`: 包含不同版本的編譯韌體 (.bin)。

## 🕒 更新日誌 (Changelog)

### [v0.1.1] - 2026-05-07 (AHT20-BMP280 Branch)
- **感測器升級**：支援 AHT20 (濕度) 與 BMP280 (氣壓) 的 I2C 組合。
- **診斷功能**：新增開機 I2C 掃描器，自動偵測 0x38, 0x76, 0x77 地址。
- **顯示優化**：
  - 解決數字變更時的殘影問題（使用區域清空邏輯）。
  - 優化橫向模式下的佈局，避免日期與氣壓重疊。
- **穩定性提升**：若 AHT20 溫度讀取異常，自動切換至 BMP280 作為備援。

### [v0.2.0] - 2026-05-07 (Main Branch)
- **優化按鈕響應**：解決 WiFi 斷線時按鈕失效問題。
- **改善開機體驗**：新增開機 2 秒強制重置功能。

### [v0.1.0] - 2026-05-06
- **初始版本**：基本溫濕度監測與 NTP 時間顯示。

---
*Made with ❤️ by laixiaoyi00*
