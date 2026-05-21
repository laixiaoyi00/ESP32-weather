// ========================================
// 🌡️ Home Weather Station PWA - App Logic
// ThingSpeak API + Chart.js Integration
// ========================================

// ── ThingSpeak Configuration ──
const CONFIG = {
  channelId: '3390904',
  readApiKey: 'OCMIZTU1DBQZC6L6',
  refreshInterval: 30000,      // 30 seconds auto-refresh
  historyResults: 120,         // number of data points to fetch
  apiBase: 'https://api.thingspeak.com',
};

// ── State ──
let chart = null;
let refreshTimer = null;
let progressTimer = null;
let progressValue = 0;
let lastTemp = null;
let lastHum = null;
let isLoading = false;

// ── DOM Elements ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialize App ──
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  showLoadingState();
  await fetchLatestData();
  await fetchHistoryData();
  startAutoRefresh();
}

// ── Fetch Latest Data ──
async function fetchLatestData() {
  setStatusLoading();
  
  try {
    const url = `${CONFIG.apiBase}/channels/${CONFIG.channelId}/feeds/last.json?api_key=${CONFIG.readApiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (!data || (!data.field1 && !data.field2)) {
      throw new Error('No data available');
    }

    const temp = parseFloat(data.field1);
    const hum = parseFloat(data.field2);
    const timestamp = data.created_at;

    updateDisplay(temp, hum, timestamp);
    setStatusOnline();
    hideError();

  } catch (error) {
    console.error('Fetch error:', error);
    setStatusOffline();
    
    if (lastTemp === null) {
      showError('無法連線', '無法從 ThingSpeak 取得數據。請確認 ESP32 已上傳數據，並檢查網路連線。');
    }
  }
}

// ── Fetch History Data ──
async function fetchHistoryData(results = CONFIG.historyResults) {
  try {
    const url = `${CONFIG.apiBase}/channels/${CONFIG.channelId}/feeds.json?api_key=${CONFIG.readApiKey}&results=${results}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (data.feeds && data.feeds.length > 0) {
      renderChart(data.feeds);
    }

  } catch (error) {
    console.error('History fetch error:', error);
  }
}

// ── Update Display ──
function updateDisplay(temp, hum, timestamp) {
  const tempEl = $('#temp-value');
  const humEl = $('#hum-value');
  
  // Update temperature
  if (!isNaN(temp)) {
    const prevTemp = lastTemp;
    lastTemp = temp;
    
    tempEl.innerHTML = `${temp.toFixed(1)}<span class="unit">°C</span>`;
    tempEl.className = 'card-value ' + getTempColorClass(temp);
    
    // Animate value change
    if (prevTemp !== null && prevTemp !== temp) {
      tempEl.classList.add('value-updated');
      setTimeout(() => tempEl.classList.remove('value-updated'), 300);
    }
    
    // Update comfort tag
    const tempComfort = getTempComfort(temp);
    $('#temp-comfort').textContent = tempComfort.text;
    $('#temp-comfort').style.color = tempComfort.color;
  }
  
  // Update humidity
  if (!isNaN(hum)) {
    const prevHum = lastHum;
    lastHum = hum;
    
    humEl.innerHTML = `${hum.toFixed(1)}<span class="unit">%</span>`;
    humEl.className = 'card-value ' + getHumColorClass(hum);
    
    if (prevHum !== null && prevHum !== hum) {
      humEl.classList.add('value-updated');
      setTimeout(() => humEl.classList.remove('value-updated'), 300);
    }
    
    const humComfort = getHumComfort(hum);
    $('#hum-comfort').textContent = humComfort.text;
    $('#hum-comfort').style.color = humComfort.color;
  }
  
  // Update overall comfort banner
  if (!isNaN(temp) && !isNaN(hum)) {
    updateComfortBanner(temp, hum);
  }
  
  // Update timestamp
  if (timestamp) {
    const date = new Date(timestamp);
    $('#update-time').textContent = formatTime(date);
  }
  
  // Remove loading skeletons
  hideLoadingState();
}

// ── Temperature Classification ──
function getTempColorClass(t) {
  if (t < 5) return 'temp-freezing';
  if (t < 15) return 'temp-cold';
  if (t < 20) return 'temp-cool';
  if (t < 28) return 'temp-comfortable';
  if (t < 33) return 'temp-warm';
  if (t < 38) return 'temp-hot';
  return 'temp-very-hot';
}

function getTempComfort(t) {
  if (t < 5) return { text: '🥶 極冷', color: '#4fc3f7' };
  if (t < 15) return { text: '❄️ 偏冷', color: '#29b6f6' };
  if (t < 20) return { text: '🌤 涼爽', color: '#4dd0e1' };
  if (t < 28) return { text: '😊 舒適', color: '#69f0ae' };
  if (t < 33) return { text: '🌡️ 偏熱', color: '#ffd54f' };
  if (t < 38) return { text: '🔥 很熱', color: '#ffab40' };
  return { text: '⚠️ 酷熱', color: '#ff5252' };
}

function getHumColorClass(h) {
  if (h < 30) return 'hum-dry';
  if (h < 60) return 'hum-comfortable';
  if (h < 80) return 'hum-humid';
  return 'hum-very-humid';
}

function getHumComfort(h) {
  if (h < 30) return { text: '🏜️ 乾燥', color: '#ffab40' };
  if (h < 60) return { text: '👍 適中', color: '#69f0ae' };
  if (h < 80) return { text: '💧 潮濕', color: '#42a5f5' };
  return { text: '🌊 非常潮濕', color: '#7c4dff' };
}

// ── Comfort Banner ──
function updateComfortBanner(temp, hum) {
  const bannerEmoji = $('.comfort-emoji');
  const bannerTitle = $('.comfort-title');
  const bannerDesc = $('.comfort-desc');
  
  let emoji, title, desc;
  
  if (temp >= 20 && temp <= 26 && hum >= 40 && hum <= 60) {
    emoji = '😊';
    title = '環境非常舒適';
    desc = '溫度和濕度都在理想範圍內，享受好天氣吧！';
  } else if (temp < 15) {
    emoji = '🧥';
    title = '天氣偏冷';
    desc = `目前 ${temp.toFixed(1)}°C，建議多穿一件外套保暖。`;
  } else if (temp > 33) {
    emoji = '🥵';
    title = '注意高溫';
    desc = `目前 ${temp.toFixed(1)}°C，記得多喝水、注意防暑。`;
  } else if (hum > 80) {
    emoji = '💦';
    title = '濕度偏高';
    desc = `濕度 ${hum.toFixed(0)}%，體感可能悶熱，建議開除濕機。`;
  } else if (hum < 30) {
    emoji = '🏜️';
    title = '空氣乾燥';
    desc = `濕度僅 ${hum.toFixed(0)}%，記得補充水分、注意保濕。`;
  } else if (temp > 28) {
    emoji = '☀️';
    title = '溫度偏高';
    desc = `目前 ${temp.toFixed(1)}°C，可以開空調降溫。`;
  } else {
    emoji = '🏠';
    title = '環境狀態良好';
    desc = `溫度 ${temp.toFixed(1)}°C、濕度 ${hum.toFixed(0)}%，整體舒適。`;
  }
  
  bannerEmoji.textContent = emoji;
  bannerTitle.textContent = title;
  bannerDesc.textContent = desc;
}

// ── Chart Rendering ──
function renderChart(feeds) {
  const labels = [];
  const tempData = [];
  const humData = [];
  
  feeds.forEach(feed => {
    const date = new Date(feed.created_at);
    labels.push(formatChartTime(date));
    tempData.push(parseFloat(feed.field1) || null);
    humData.push(parseFloat(feed.field2) || null);
  });
  
  const ctx = document.getElementById('history-chart');
  if (!ctx) return;
  
  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = tempData;
    chart.data.datasets[1].data = humData;
    chart.update('none');
    return;
  }
  
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '溫度 (°C)',
          data: tempData,
          borderColor: '#ff6b35',
          backgroundColor: 'rgba(255, 107, 53, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#ff6b35',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: '濕度 (%)',
          data: humData,
          borderColor: '#42a5f5',
          backgroundColor: 'rgba(66, 165, 245, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#42a5f5',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#8888aa',
            font: { size: 11, family: 'Inter' },
            boxWidth: 12,
            boxHeight: 2,
            padding: 16,
            usePointStyle: false,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(18, 18, 42, 0.95)',
          titleColor: '#f0f0f8',
          bodyColor: '#ccccdd',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          titleFont: { size: 12, weight: '600', family: 'Inter' },
          bodyFont: { size: 11, family: 'Inter' },
          displayColors: true,
          boxPadding: 4,
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false,
          },
          ticks: {
            color: '#555577',
            font: { size: 10, family: 'Inter' },
            maxTicksLimit: 6,
            maxRotation: 0,
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false,
          },
          ticks: {
            color: '#ff6b35',
            font: { size: 10, family: 'Inter' },
            callback: (v) => v + '°',
          },
          title: {
            display: false,
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#42a5f5',
            font: { size: 10, family: 'Inter' },
            callback: (v) => v + '%',
          },
          title: {
            display: false,
          }
        }
      }
    }
  });
}

// ── Auto Refresh ──
function startAutoRefresh() {
  stopAutoRefresh();
  progressValue = 0;
  updateProgressBar();
  
  progressTimer = setInterval(() => {
    progressValue += (1000 / CONFIG.refreshInterval) * 100;
    if (progressValue > 100) progressValue = 100;
    updateProgressBar();
  }, 1000);
  
  refreshTimer = setInterval(async () => {
    progressValue = 0;
    updateProgressBar();
    await fetchLatestData();
    await fetchHistoryData();
  }, CONFIG.refreshInterval);
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (progressTimer) clearInterval(progressTimer);
}

function updateProgressBar() {
  const bar = $('.auto-refresh-progress');
  if (bar) bar.style.width = progressValue + '%';
}

// ── Manual Refresh ──
async function manualRefresh() {
  const btn = $('.refresh-btn');
  if (isLoading) return;
  
  isLoading = true;
  btn.classList.add('loading');
  
  // Reset auto-refresh timer
  stopAutoRefresh();
  
  await fetchLatestData();
  await fetchHistoryData();
  
  isLoading = false;
  btn.classList.remove('loading');
  
  startAutoRefresh();
}

// ── Period Button Handler ──
function setPeriod(results, btn) {
  $$('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fetchHistoryData(results);
}

// ── UI State Helpers ──
function setStatusOnline() {
  const dot = $('.status-dot');
  const text = $('.status-text');
  dot.className = 'status-dot';
  text.textContent = '即時連線中';
}

function setStatusOffline() {
  const dot = $('.status-dot');
  const text = $('.status-text');
  dot.className = 'status-dot offline';
  text.textContent = '連線中斷';
}

function setStatusLoading() {
  const dot = $('.status-dot');
  const text = $('.status-text');
  dot.className = 'status-dot loading';
  text.textContent = '正在載入...';
}

function showLoadingState() {
  // Show skeletons, hide real values
  $$('.skeleton-group').forEach(el => el.style.display = 'block');
  $$('.real-data').forEach(el => el.style.display = 'none');
}

function hideLoadingState() {
  $$('.skeleton-group').forEach(el => el.style.display = 'none');
  $$('.real-data').forEach(el => el.style.display = 'block');
}

function showError(title, desc) {
  const overlay = $('.error-overlay');
  if (!overlay) return;
  
  $('.error-title').textContent = title;
  $('.error-desc').textContent = desc;
  overlay.classList.add('visible');
}

function hideError() {
  const overlay = $('.error-overlay');
  if (overlay) overlay.classList.remove('visible');
}

// ── Time Formatting ──
function formatTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatChartTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
