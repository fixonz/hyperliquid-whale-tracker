// Telegram WebApp Integration with Hyperlens.io
class TelegramWhaleTracker {
  constructor() {
    this.tg = window.Telegram?.WebApp;
    this.currentSection = 'alerts';
    this.ws = null;
    this.hyperlensAPI = null;
    this.currentTab = 'heatmap';
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
      
      // Set up Telegram WebApp features
      this.tg.MainButton.setText('Open Full Dashboard');
      this.tg.MainButton.onClick(() => {
        this.tg.openLink('https://app.hyperliquid.xyz');
      });
      this.tg.MainButton.show();
    }

    this.connectWebSocket();
    this.loadInitialData();
    this.setupEventListeners();
    this.initializeHyperlens();
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
      const [stats, heatmap, alerts, positions, whales] = await Promise.all([
        fetch(`${baseUrl}/api/stats`).then(r => r.json()),
        fetch(`${baseUrl}/api/heatmap`).then(r => r.json()),
        fetch(`${baseUrl}/api/alerts`).then(r => r.json()),
        fetch(`${baseUrl}/api/positions`).then(r => r.json()),
        fetch(`${baseUrl}/api/whales`).then(r => r.json()).catch(() => [])
      ]);

      this.updateStats(stats);
      this.renderHeatmap(heatmap);
      this.renderAlerts(alerts);
      this.renderPositions(positions);
      this.renderWhales(whales);
      this.populateAssetSelect(heatmap);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  populateAssetSelect(heatmap) {
    const select = document.getElementById('assetSelect');
    if (!select || !heatmap || !heatmap.assets) return;
    
    const options = heatmap.assets.map(a => 
      `<option value="${a.asset}">${a.asset}</option>`
    ).join('');
    
    select.innerHTML = '<option value="">All Assets</option>' + options;
  }

  updateStats(stats) {
    document.getElementById('whalesCount').textContent = stats.whalesTracked || 0;
    document.getElementById('positionsCount').textContent = stats.positionsMonitored || 0;
    
    // Calculate total risk from heatmap
    if (stats.totalRisk) {
      document.getElementById('riskValue').textContent = this.formatLargeNumber(stats.totalRisk);
    }
  }

  renderHeatmap(heatmap, asset = null) {
    this.lastHeatmap = heatmap;
    const container = document.getElementById('heatmapContainer');
    
    if (!heatmap || !heatmap.globalLevels || heatmap.globalLevels.length === 0) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>No liquidation data yet</p>
        </div>
      `;
      return;
    }

    const levels = asset ? 
      (heatmap.assets?.find(a => a.asset === asset)?.levels || []) :
      heatmap.globalLevels;
    
    const maxNotional = Math.max(...levels.map(l => l.totalNotional || 0));
    
    if (levels.length === 0) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>No data for selected asset</p>
        </div>
      `;
      return;
    }
    
    const barsHTML = levels.slice(0, 20).map(level => {
      const height = maxNotional > 0 ? (level.totalNotional / maxNotional) * 100 : 5;
      const isLong = (level.longNotional || 0) > (level.shortNotional || 0);
      const side = isLong ? 'long' : 'short';
      
      return `<div class="heatmap-bar ${side}" style="height: ${Math.max(height, 8)}%" 
               title="$${this.formatLargeNumber(level.totalNotional)} at ${level.percentFromCurrent?.toFixed(1) || 0}%"></div>`;
    }).join('');

    const totalRisk = levels.reduce((sum, level) => sum + (level.totalNotional || 0), 0);
    const totalPositions = levels.reduce((sum, level) => sum + (level.positionCount || 0), 0);

    container.innerHTML = `
      <div class="heatmap-stats">
        <div class="heatmap-stat">
          <div class="heatmap-stat-value">$${this.formatLargeNumber(totalRisk)}</div>
          <div class="heatmap-stat-label">Total Risk</div>
        </div>
        <div class="heatmap-stat">
          <div class="heatmap-stat-value">${totalPositions}</div>
          <div class="heatmap-stat-label">Positions</div>
        </div>
      </div>
      <div class="heatmap-bars">${barsHTML}</div>
    `;
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

  renderPositions(positions, filter = 'all') {
    this.lastPositions = positions;
    const container = document.getElementById('positionsContainer');
    
    if (!positions || positions.length === 0) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>No active positions</p>
        </div>
      `;
      return;
    }

    let filteredPositions = positions;
    if (filter === 'longs') {
      filteredPositions = positions.filter(p => p.side === 'LONG');
    } else if (filter === 'shorts') {
      filteredPositions = positions.filter(p => p.side === 'SHORT');
    }

    const positionsHTML = filteredPositions.slice(0, 20).map(pos => {
      const side = pos.side || 'LONG';
      const sideClass = side.toLowerCase();
      const distance = pos.liquidationDistance || 0;
      const riskClass = distance < 5 ? 'high-risk' : distance < 15 ? 'medium-risk' : 'low-risk';
      
      return `
        <div class="position-item ${riskClass}">
          <div class="position-header">
            <span class="position-asset">#${pos.asset}</span>
            <span class="position-side ${sideClass}">${side}</span>
            <span class="position-value">$${this.formatLargeNumber(pos.positionValue || 0)}</span>
          </div>
          <div class="position-details">
            <span>${pos.leverage || 0}x leverage</span>
            <span class="${riskClass}">${distance.toFixed(1)}% to liquidation</span>
          </div>
          <div class="position-address">
            <span class="wallet-link" onclick="copyAddress('${pos.address}')" title="Click to copy">
              ${pos.address ? pos.address.slice(0, 8) + '...' + pos.address.slice(-6) : 'Unknown'}
            </span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = positionsHTML;
  }

  renderWhales(whales, sortBy = 'pnl') {
    this.lastWhales = whales;
    const container = document.getElementById('whalesContainer');
    
    if (!whales || whales.length === 0) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>No whale data available</p>
        </div>
      `;
      return;
    }

    let sortedWhales = [...whales];
    switch (sortBy) {
      case 'roi':
        sortedWhales.sort((a, b) => (b.roi || 0) - (a.roi || 0));
        break;
      case 'risk':
        sortedWhales.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
        break;
      default:
        sortedWhales.sort((a, b) => (b.totalPnL || 0) - (a.totalPnL || 0));
    }

    const whalesHTML = sortedWhales.slice(0, 20).map((whale, index) => {
      const pnlClass = whale.totalPnL >= 0 ? 'positive' : 'negative';
      const roiClass = whale.roi >= 0 ? 'positive' : 'negative';
      
      return `
        <div class="whale-card">
          <div class="whale-header">
            <span class="whale-rank">#${index + 1}</span>
            <span class="whale-roi ${roiClass}">${whale.roi >= 0 ? '+' : ''}${(whale.roi || 0).toFixed(2)}% ROI</span>
          </div>
          <div class="whale-details">
            <div class="whale-detail-row">
              <span class="whale-label">Total PnL:</span>
              <span class="whale-value ${pnlClass}">${whale.totalPnL >= 0 ? '+' : ''}$${this.formatLargeNumber(Math.abs(whale.totalPnL || 0))}</span>
            </div>
            <div class="whale-detail-row">
              <span class="whale-label">Margin:</span>
              <span class="whale-value">$${this.formatLargeNumber(whale.marginUsed || 0)}</span>
            </div>
            <div class="whale-detail-row">
              <span class="whale-label">Trades:</span>
              <span class="whale-value">${whale.totalTrades || 0}</span>
            </div>
            <div class="whale-detail-row">
              <span class="whale-label">Positions:</span>
              <span class="whale-value">${whale.activePositions || 0}</span>
            </div>
          </div>
          <div class="whale-address">
            <span class="wallet-link" onclick="copyAddress('${whale.address}')" title="Click to copy">
              ${whale.address ? whale.address.slice(0, 8) + '...' + whale.address.slice(-6) : 'Unknown'}
            </span>
            <a href="https://app.hyperliquid.xyz/explorer/account?address=${whale.address}" target="_blank" class="explorer-link">🔗</a>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = whalesHTML;
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
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.currentTarget.dataset.filter;
        this.filterPositions(filter);
      });
    });

    // Asset selector
    const assetSelect = document.getElementById('assetSelect');
    if (assetSelect) {
      assetSelect.addEventListener('change', (e) => {
        this.filterHeatmapByAsset(e.target.value);
      });
    }

    // Whale sort selector
    const whaleSort = document.getElementById('whaleSort');
    if (whaleSort) {
      whaleSort.addEventListener('change', (e) => {
        this.sortWhales(e.target.value);
      });
    }

    // Pull to refresh
    this.setupPullToRefresh();

    // Touch gestures
    this.setupTouchGestures();
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Update Telegram WebApp title
    if (this.tg) {
      const titles = {
        'heatmap': '🔥 Liquidation Heatmap',
        'positions': '📊 Whale Positions',
        'alerts': '🚨 Live Alerts',
        'whales': '🐋 Top Whales'
      };
      this.tg.setHeaderColor(tabName === 'alerts' ? '#ff4444' : '#00ff41');
    }
  }

  filterPositions(filter) {
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    
    // Re-render positions with filter
    this.renderPositions(this.lastPositions, filter);
  }

  filterHeatmapByAsset(asset) {
    // Re-render heatmap with asset filter
    if (this.lastHeatmap) {
      this.renderHeatmap(this.lastHeatmap, asset);
    }
  }

  sortWhales(sortBy) {
    // Re-render whales with new sort
    if (this.lastWhales) {
      this.renderWhales(this.lastWhales, sortBy);
    }
  }

  setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isRefreshing = false;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (window.scrollY === 0 && !isRefreshing) {
        currentY = e.touches[0].clientY;
        const pullDistance = currentY - startY;
        
        if (pullDistance > 0) {
          const pullRefresh = document.getElementById('pullRefresh');
          const progress = Math.min(pullDistance / 100, 1);
          
          pullRefresh.style.transform = `translateY(${Math.min(pullDistance * 0.5, 50)}px)`;
          pullRefresh.style.opacity = progress;
          
          if (pullDistance > 100) {
            pullRefresh.querySelector('.refresh-text').textContent = 'Release to refresh';
          } else {
            pullRefresh.querySelector('.refresh-text').textContent = 'Pull to refresh';
          }
        }
      }
    });

    document.addEventListener('touchend', (e) => {
      if (window.scrollY === 0 && !isRefreshing) {
        const pullDistance = currentY - startY;
        
        if (pullDistance > 100) {
          this.refreshData();
        }
        
        // Reset pull refresh indicator
        const pullRefresh = document.getElementById('pullRefresh');
        pullRefresh.style.transform = 'translateY(-100px)';
        pullRefresh.style.opacity = '0';
      }
    });
  }

  setupTouchGestures() {
    // Add haptic feedback for important actions
    if (this.tg && this.tg.HapticFeedback) {
      document.querySelectorAll('.alert-item, .position-item, .whale-card').forEach(item => {
        item.addEventListener('touchstart', () => {
          this.tg.HapticFeedback.impactOccurred('light');
        });
      });
    }
  }

  initializeHyperlens() {
    // Initialize Hyperlens API client (would need to be included)
    // this.hyperlensAPI = new HyperlensAPI();
    console.log('Hyperlens.io integration ready');
  }

  async refreshData() {
    console.log('Refreshing data...');
    
    // Show refresh indicator
    const pullRefresh = document.getElementById('pullRefresh');
    pullRefresh.querySelector('.refresh-text').textContent = 'Refreshing...';
    pullRefresh.style.transform = 'translateY(0px)';
    pullRefresh.style.opacity = '1';

    try {
      await this.loadInitialData();
      
      // Haptic feedback for successful refresh
      if (this.tg && this.tg.HapticFeedback) {
        this.tg.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      
      // Haptic feedback for error
      if (this.tg && this.tg.HapticFeedback) {
        this.tg.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      // Hide refresh indicator
      setTimeout(() => {
        pullRefresh.style.transform = 'translateY(-100px)';
        pullRefresh.style.opacity = '0';
      }, 1000);
    }
  }

  openInBrowser() {
    if (this.tg) {
      this.tg.openLink(window.location.href.replace('/telegram-app.html', ''));
    } else {
      window.open(window.location.href.replace('/telegram-app.html', ''), '_blank');
    }
  }

  shareDashboard() {
    if (this.tg) {
      this.tg.showAlert('Share this dashboard with other traders!');
    } else if (navigator.share) {
      navigator.share({
        title: 'Hyperliquid Whale Tracker',
        text: 'Real-time whale liquidation monitoring',
        url: window.location.href.replace('/telegram-app.html', '')
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href.replace('/telegram-app.html', ''));
      alert('Dashboard URL copied to clipboard!');
    }
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

// Global functions for HTML onclick handlers
window.refreshData = function() {
  if (window.telegramTracker) {
    window.telegramTracker.refreshData();
  }
};

window.openInBrowser = function() {
  if (window.telegramTracker) {
    window.telegramTracker.openInBrowser();
  }
};

window.shareDashboard = function() {
  if (window.telegramTracker) {
    window.telegramTracker.shareDashboard();
  }
};

window.copyAddress = function(address) {
  navigator.clipboard.writeText(address).then(() => {
    // Show feedback
    if (window.telegramTracker && window.telegramTracker.tg && window.telegramTracker.tg.HapticFeedback) {
      window.telegramTracker.tg.HapticFeedback.impactOccurred('light');
    }
    
    // Visual feedback
    const originalText = event.target.textContent;
    event.target.textContent = 'Copied!';
    event.target.style.color = '#00ff41';
    
    setTimeout(() => {
      event.target.textContent = originalText;
      event.target.style.color = '';
    }, 1000);
  }).catch(err => {
    console.error('Failed to copy address:', err);
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = address;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  });
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.telegramTracker = new TelegramWhaleTracker();
});
