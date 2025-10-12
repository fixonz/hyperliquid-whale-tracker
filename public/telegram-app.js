// Telegram WebApp Integration
class TelegramWhaleTracker {
  constructor() {
    this.tg = window.Telegram?.WebApp;
    this.currentSection = 'alerts';
    this.ws = null;
    this.init();
  }

  init() {
    // Initialize Telegram WebApp
    if (this.tg) {
      this.tg.ready();
      this.tg.expand();
      
      // Set theme colors
      document.body.style.setProperty('--tg-theme-bg-color', this.tg.themeParams.bg_color || '#0a0e1a');
      document.body.style.setProperty('--tg-theme-text-color', this.tg.themeParams.text_color || '#00ff41');
      document.body.style.setProperty('--tg-theme-secondary-bg-color', this.tg.themeParams.secondary_bg_color || 'rgba(0, 0, 0, 0.3)');
      document.body.style.setProperty('--tg-theme-hint-color', this.tg.themeParams.hint_color || '#888');
      document.body.style.setProperty('--tg-theme-button-color', this.tg.themeParams.button_color || '#00ff41');
    }

    this.connectWebSocket();
    this.loadInitialData();
    this.setupEventListeners();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.updateStatus('Connected', 'connected');
      console.log('WebSocket connected');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      this.updateStatus('Reconnecting...', 'disconnected');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('Connection Error', 'error');
    };
  }

  async loadInitialData() {
    try {
      const baseUrl = window.location.origin;
      const [stats, heatmap, alerts, positions] = await Promise.all([
        fetch(`${baseUrl}/api/stats`).then(r => r.json()),
        fetch(`${baseUrl}/api/heatmap`).then(r => r.json()),
        fetch(`${baseUrl}/api/alerts`).then(r => r.json()),
        fetch(`${baseUrl}/api/positions`).then(r => r.json())
      ]);

      this.updateStats(stats);
      this.renderHeatmap(heatmap);
      this.renderAlerts(alerts);
      this.renderPositions(positions);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  updateStats(stats) {
    document.getElementById('whalesCount').textContent = stats.whalesTracked || 0;
    document.getElementById('positionsCount').textContent = stats.positionsMonitored || 0;
    
    // Calculate total risk from heatmap
    if (stats.totalRisk) {
      document.getElementById('riskValue').textContent = this.formatLargeNumber(stats.totalRisk);
    }
  }

  renderHeatmap(heatmap) {
    const container = document.getElementById('heatmapBars');
    
    if (!heatmap || !heatmap.globalLevels || heatmap.globalLevels.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No liquidation data yet</div>';
      return;
    }

    const levels = heatmap.globalLevels.slice(0, 20); // Limit for mobile
    const maxNotional = Math.max(...levels.map(l => l.totalNotional || 0));
    
    const barsHTML = levels.map(level => {
      const height = maxNotional > 0 ? (level.totalNotional / maxNotional) * 100 : 5;
      const isLong = (level.longNotional || 0) > (level.shortNotional || 0);
      const side = isLong ? 'long' : 'short';
      
      return `<div class="heatmap-bar ${side}" style="height: ${Math.max(height, 8)}%" 
               title="$${this.formatLargeNumber(level.totalNotional)} at ${level.percentFromCurrent.toFixed(1)}%"></div>`;
    }).join('');

    container.innerHTML = barsHTML;
  }

  renderAlerts(alerts) {
    const container = document.getElementById('alertsFeed');
    
    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="alert-item">
          <div class="alert-icon">⏳</div>
          <div class="alert-content">
            <div class="alert-title">Waiting for alerts...</div>
            <div class="alert-subtitle">Monitoring whale activity</div>
          </div>
        </div>
      `;
      return;
    }

    const alertsHTML = alerts.slice(0, 10).reverse().map(alert => {
      const timeAgo = this.getTimeAgo(alert.timestamp);
      const isLiquidation = alert.type === 'LIQUIDATION';
      
      return `
        <div class="alert-item ${isLiquidation ? 'liquidation-alert' : ''}">
          <div class="alert-icon">${this.getAlertIcon(alert.type)}</div>
          <div class="alert-content">
            <div class="alert-title">${this.getAlertTitle(alert)}</div>
            <div class="alert-subtitle">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = alertsHTML;
  }

  renderPositions(positions) {
    const container = document.getElementById('positionsFeed');
    
    if (!positions || positions.length === 0) {
      container.innerHTML = `
        <div class="position-item">
          <div class="position-header">
            <span class="position-asset">#NONE</span>
            <span class="position-side">NO</span>
            <span class="position-value">$0</span>
          </div>
          <div class="position-details">
            <span>No active positions</span>
          </div>
        </div>
      `;
      return;
    }

    const positionsHTML = positions.slice(0, 10).map(pos => {
      const side = pos.side || 'LONG';
      const sideClass = side.toLowerCase();
      const distance = pos.liquidationDistance || 0;
      
      return `
        <div class="position-item">
          <div class="position-header">
            <span class="position-asset">#${pos.asset}</span>
            <span class="position-side ${sideClass}">${side}</span>
            <span class="position-value">${this.formatLargeNumber(pos.positionValue)}</span>
          </div>
          <div class="position-details">
            <span>${pos.leverage || 0}x leverage</span>
            <span>${distance.toFixed(1)}% to liquidation</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = positionsHTML;
  }

  handleWebSocketMessage(data) {
    if (data.stats) this.updateStats(data.stats);
    if (data.alerts) this.renderAlerts(data.alerts);
    if (data.positions) this.renderPositions(data.positions);
    if (data.heatmap) this.renderHeatmap(data.heatmap);
  }

  updateStatus(text, type) {
    const indicator = document.getElementById('statusIndicator');
    const dot = indicator.querySelector('.status-dot');
    const textEl = indicator.querySelector('span:last-child');
    
    textEl.textContent = text;
    dot.className = `status-dot ${type}`;
  }

  setupEventListeners() {
    // Bottom navigation
    window.showSection = (section) => {
      this.currentSection = section;
      
      // Update nav buttons
      document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.closest('.nav-button').classList.add('active');
      
      // Show/hide sections
      document.querySelectorAll('.section').forEach(el => {
        el.classList.remove('active');
      });
      
      // For now, we'll keep all sections visible since we don't have separate section divs
      // In a full implementation, you'd show/hide different sections
    };
  }

  // Helper functions
  formatLargeNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
  }

  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  getAlertIcon(type) {
    const icons = {
      'LIQUIDATION': '🔥',
      'WHALE_OPEN': '🐋',
      'WHALE_CLOSE': '🐋',
      'LIQUIDATION_RISK': '⚠️',
      'NEW_WHALE_DISCOVERED': '🆕',
      'LARGE_POSITION': '💰'
    };
    return icons[type] || '📢';
  }

  getAlertTitle(alert) {
    if (alert.type === 'LIQUIDATION') {
      const side = alert.side === 'LONG' ? '🟢 Long' : '🔴 Short';
      return `${side} Liquidated: $${this.formatLargeNumber(alert.notional || 0)}`;
    }
    
    const titles = {
      'WHALE_OPEN': 'Whale Position Opened',
      'WHALE_CLOSE': 'Whale Position Closed',
      'LIQUIDATION_RISK': 'Liquidation Risk',
      'NEW_WHALE_DISCOVERED': 'New Whale Discovered',
      'LARGE_POSITION': 'Large Position Detected'
    };
    return titles[alert.type] || alert.type.replace(/_/g, ' ');
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new TelegramWhaleTracker();
});
