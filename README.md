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

## 🛠️ 硬體清單

- **主控板**：ESP32-S3
- **顯示器**：ST7735 TFT (128x160)
- **感測器**：DHT11 (或 DHT22)
- **其他**：按鈕 x1 (GPIO 14)

## 🚀 快速開始

1. **硬體連接**：參考程式碼中的腳位定義 (TFT_CS, DHTPIN 等) 進行接線。
2. **安裝程式庫**：
   - `WiFiManager`
   - `Adafruit ST7735`
   - `Adafruit GFX`
   - `DHT sensor library`
3. **燒錄程式**：使用 Arduino IDE 或 arduino-cli 將 `ew.ino` 燒錄至開發板。
4. **設定 WiFi**：
   - 用手機連線至 WiFi 熱點 `WeatherStation`。
   - 在彈出的網頁中選擇你的 WiFi 並輸入密碼。
   - 儲存後裝置將自動重啟並開始運作！

## 📄 專案結構

- `ESP32-weather/ESP32-weather.ino`: 主程式邏輯。
- `.gitignore`: 已自動忽略敏感資訊及暫存檔。

---
*Made with ❤️ by laixiaoyi00*
