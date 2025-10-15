// WebSocket connection
let ws = null;
let reconnectInterval = null;
let currentTab = 'all';

// State
const state = {
  stats: {},
  heatmap: null,
  positions: [],
  alerts: [],
  whales: [],
  prices: {}
};

// Initialize
function init() {
  connectWebSocket();
  setupEventListeners();
  fetchInitialData();
}

// WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    updateStatus('Connected', 'positive');
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateStatus('Disconnected', 'negative');
    attemptReconnect();
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateStatus('Error', 'negative');
  };
}

function attemptReconnect() {
  if (reconnectInterval) return;
  
  reconnectInterval = setInterval(() => {
    console.log('Attempting to reconnect...');
    connectWebSocket();
  }, 5000);
}

function handleWebSocketMessage(message) {
  if (message.type === 'init' || message.type === 'update') {
    if (message.data.stats) {
      state.stats = message.data.stats;
      updateStats();
    }
    
    if (message.data.heatmap) {
      state.heatmap = message.data.heatmap;
      renderHeatmap();
    }
    
    if (message.data.positions) {
      state.positions = message.data.positions;
      renderPositions();
    }
    
    if (message.data.alerts) {
      state.alerts = message.data.alerts;
      renderAlerts();
    }
    
    if (message.data.digestStats) {
      state.digestStats = message.data.digestStats;
      renderDigestStats();
    }
  }
}

// Fetch initial data
async function fetchInitialData() {
  try {
    const [stats, heatmap, positions, alerts, whales, prices, digestStats] = await Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/heatmap').then(r => r.json()),
      fetch('/api/positions').then(r => r.json()),
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/whales').then(r => r.json()),
      fetch('/api/prices').then(r => r.json()),
      fetch('/api/digest-stats').then(r => r.json())
    ]);
    
    state.stats = stats;
    state.heatmap = heatmap;
    state.positions = positions;
    state.alerts = alerts;
    state.whales = whales;
    state.prices = prices;
    state.digestStats = digestStats;
    
    updateStats();
    renderHeatmap();
    renderPositions();
    renderAlerts();
    renderWhales();
    renderDiscoveryStats();
    renderDigestStats();
    populateAssetSelect();
  } catch (error) {
    console.error('Error fetching initial data:', error);
  }
}

// Update stats display
function updateStats() {
  document.getElementById('whalesTracked').textContent = state.stats.whalesTracked || 0;
  document.getElementById('positionsCount').textContent = state.stats.positionsMonitored || 0;
  document.getElementById('newAddresses').textContent = state.stats?.discoveryStats?.totalAdded || 0;
  document.getElementById('totalScans').textContent = state.stats.totalScans || 0;
  document.getElementById('totalLiquidations').textContent = state.stats.totalLiquidations || 0;
  document.getElementById('liquidationVolume').textContent = `$${formatLargeNumber(state.stats.liquidationVolume || 0)}`;
}

function updateStatus(text, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = text;
  statusEl.className = `stat-value status ${type}`;
}

// Render heatmap
function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  
  // Show helpful message if no data yet
  if (!state.heatmap || !state.heatmap.globalLevels || state.heatmap.globalLevels.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="margin-bottom: 30px; text-align: center;">
          <h2 style="color: #00ff41; margin-bottom: 10px;">🔥 Liquidation Heatmap</h2>
          <p style="color: #ccc; font-size: 16px; margin-bottom: 20px;">See where liquidations will happen when prices move</p>
        </div>
        
        <div style="background: rgba(0, 255, 65, 0.1); border: 1px solid rgba(0, 255, 65, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #00ff41; margin-bottom: 15px;">🎯 What This Shows:</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; color: #ccc;">
            <div>
              <div style="color: #00ff41; font-weight: bold;">📈 Long Liquidations</div>
              <div style="font-size: 14px; margin-top: 5px;">When prices drop, long positions get liquidated</div>
            </div>
            <div>
              <div style="color: #ff4444; font-weight: bold;">📉 Short Liquidations</div>
              <div style="font-size: 14px; margin-top: 5px;">When prices rise, short positions get liquidated</div>
            </div>
          </div>
        </div>
        
        <div style="background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.3); border-radius: 12px; padding: 20px;">
          <h3 style="color: #ff4444; margin-bottom: 15px;">💡 How to Read It:</h3>
          <div style="color: #ccc; font-size: 14px; line-height: 1.6;">
            <div style="margin-bottom: 10px;"><strong>🔴 Red bars (left side):</strong> Long positions that will liquidate if price drops</div>
            <div style="margin-bottom: 10px;"><strong>🟢 Green bars (right side):</strong> Short positions that will liquidate if price rises</div>
            <div style="margin-bottom: 10px;"><strong>📊 Bar height:</strong> Amount of money at risk ($10M = tall bar, $100K = short bar)</div>
            <div><strong>📍 Bar position:</strong> How far price needs to move to trigger liquidations</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #888;">
          <p>⏳ <em>Waiting for whale positions to analyze...</em></p>
          <p style="font-size: 12px; margin-top: 10px;">The bot is currently scanning 225 whale wallets</p>
        </div>
      </div>
    `;
    return;
  }
  
  const selectedAsset = document.getElementById('assetSelect').value;
  const levels = selectedAsset ? 
    (state.heatmap.assets.find(a => a.asset === selectedAsset)?.levels || []) :
    state.heatmap.globalLevels;
  
  if (levels.length === 0) {
    container.innerHTML = '<div class="empty-state">No data for selected asset</div>';
    return;
  }
  
  // Find max notional for scaling
  const maxNotional = Math.max(...levels.map(l => l.totalNotional || 0));
  
  // Create bars
  const barsHTML = levels.map(level => {
    const percent = level.percentFromCurrent || 0;
    const totalNotional = level.totalNotional || 0;
    const longNotional = level.longNotional || 0;
    const shortNotional = level.shortNotional || 0;
    
    const height = maxNotional > 0 ? (totalNotional / maxNotional) * 100 : 0;
    const isLong = longNotional > shortNotional;
    const priceLevel = level.priceLevel || 0;
    const positionCount = level.positionCount || 0;
    
    return `
      <div class="heatmap-bar ${isLong ? 'long' : 'short'}" 
           title="Price: $${priceLevel.toFixed(2)} | ${percent.toFixed(2)}% move | $${formatNumber(totalNotional)} at risk">
        <div class="heatmap-bar-inner" style="height: ${Math.max(height, 5)}%"></div>
        <div class="heatmap-tooltip">
          <div><strong>${selectedAsset || 'Global'} Liquidation Zone</strong></div>
          <div>📍 Price: $${priceLevel.toFixed(2)}</div>
          <div>📊 Move: ${percent > 0 ? '+' : ''}${percent.toFixed(2)}%</div>
          <div>💰 Total Risk: $${formatNumber(totalNotional)}</div>
          <div>📈 Longs: $${formatNumber(longNotional)}</div>
          <div>📉 Shorts: $${formatNumber(shortNotional)}</div>
          <div>🎯 Positions: ${positionCount}</div>
        </div>
        <div class="heatmap-bar-label">
          <div>${percent > 0 ? '+' : ''}${percent.toFixed(1)}%</div>
          <div style="font-size: 10px; margin-top: 2px;">$${formatNumber(totalNotional)}</div>
        </div>
      </div>
    `;
  }).join('');
  
  const totalRisk = levels.reduce((sum, level) => sum + (level.totalNotional || 0), 0);
  const totalPositions = levels.reduce((sum, level) => sum + (level.positionCount || 0), 0);
  const totalLongs = levels.reduce((sum, level) => sum + (level.longNotional || 0), 0);
  const totalShorts = levels.reduce((sum, level) => sum + (level.shortNotional || 0), 0);
  
  // Calculate long/short percentages for pie chart
  const longPercent = totalRisk > 0 ? (totalLongs / totalRisk * 100) : 50;
  const shortPercent = 100 - longPercent;
  
  // Create cascade chart HTML (waterfall style)
  const cascadeHTML = levels.slice(0, 15).map((level, index) => {
    const percent = level.percentFromCurrent || 0;
    const notional = level.totalNotional || 0;
    const width = maxNotional > 0 ? (notional / maxNotional) * 100 : 0;
    const isLong = (level.longNotional || 0) > (level.shortNotional || 0);
    const longNotional = level.longNotional || 0;
    const shortNotional = level.shortNotional || 0;
    const positionCount = level.positionCount || 0;
    const priceLevel = level.priceLevel || 0;
    
    return `
      <div class="cascade-bar ${isLong ? 'long' : 'short'}" 
           title="📍 Price: $${priceLevel.toFixed(2)} | ${percent > 0 ? '+' : ''}${percent.toFixed(1)}% move
💰 Total: $${formatLargeNumber(notional)}
📈 Longs: $${formatLargeNumber(longNotional)}
📉 Shorts: $${formatLargeNumber(shortNotional)}
🎯 ${positionCount} positions">
        <div class="cascade-label">
          <span class="cascade-percent">${percent > 0 ? '+' : ''}${percent.toFixed(1)}%</span>
          <span class="cascade-value">$${formatLargeNumber(notional)}</span>
        </div>
        <div class="cascade-bar-fill" style="width: ${Math.max(width, 3)}%">
          <div class="cascade-bar-inner"></div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="heatmap-header">
      <div class="heatmap-title-section">
        <h3>🔥 Liquidation Heatmap</h3>
        <div class="asset-selector">
          <span class="current-asset">${selectedAsset || '🌍 All Assets'}</span>
        </div>
      </div>
      <div class="heatmap-stats">
        <div class="stat-card">
          <div class="stat-value">$${formatLargeNumber(totalRisk)}</div>
          <div class="stat-label">Total Risk</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalPositions}</div>
          <div class="stat-label">Positions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${levels.length}</div>
          <div class="stat-label">Levels</div>
        </div>
      </div>
    </div>

    <!-- Long/Short Distribution Pie Chart -->
    <div class="distribution-chart">
      <div class="chart-title">📊 Long vs Short Distribution</div>
      <div class="pie-chart-container">
        <div class="pie-chart">
          <div class="pie-slice long-slice" style="--percentage: ${longPercent}"></div>
          <div class="pie-chart-center">
            <div class="pie-chart-label">L/S Ratio</div>
            <div class="pie-chart-value">${(totalLongs / (totalShorts || 1)).toFixed(2)}x</div>
          </div>
        </div>
        <div class="pie-legend">
          <div class="pie-legend-item">
            <div class="pie-legend-color long"></div>
            <div class="pie-legend-text">
              <div class="pie-legend-label">📈 Longs</div>
              <div class="pie-legend-value">$${formatLargeNumber(totalLongs)} (${longPercent.toFixed(1)}%)</div>
            </div>
          </div>
          <div class="pie-legend-item">
            <div class="pie-legend-color short"></div>
            <div class="pie-legend-text">
              <div class="pie-legend-label">📉 Shorts</div>
              <div class="pie-legend-value">$${formatLargeNumber(totalShorts)} (${shortPercent.toFixed(1)}%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cascade/Waterfall Chart -->
    <div class="cascade-chart">
      <div class="chart-title">💧 Liquidation Cascade (Price Movement Impact)</div>
      <div class="cascade-container">
        ${cascadeHTML}
      </div>
    </div>
    
    <!-- Original Bar Heatmap -->
    <div class="heatmap-visualization">
      <div class="chart-title">🎯 Liquidation Density Map</div>
      <div class="price-axis">
        <div class="axis-label">Price Movement</div>
        <div class="axis-scale">
          <span>-50%</span>
          <span>-25%</span>
          <span>0%</span>
          <span>+25%</span>
          <span>+50%</span>
        </div>
      </div>
      <div class="heatmap-container">
        <div class="heatmap-bars">${barsHTML}</div>
        <div class="liquidation-zones">
          ${levels.slice(0, 10).map(level => {
            const percent = level.percentFromCurrent || 0;
            const left = Math.max(0, Math.min(100, 50 + (percent * 2)));
            return `<div class="liquidation-zone" style="left: ${left}%">
              <div class="zone-line"></div>
              <div class="zone-label">${percent > 0 ? '+' : ''}${percent.toFixed(1)}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
    
    <div class="heatmap-legend">
      <div class="legend-section">
        <div class="legend-title">Liquidation Types</div>
        <div class="legend-items">
          <div class="legend-item long">
            <div class="legend-color"></div>
            <span>📈 Long Liquidations</span>
          </div>
          <div class="legend-item short">
            <div class="legend-color"></div>
            <span>📉 Short Liquidations</span>
          </div>
        </div>
      </div>
      <div class="legend-section">
        <div class="legend-title">Risk Levels</div>
        <div class="legend-items">
          <div class="legend-item low-risk">
            <div class="legend-color"></div>
            <span>🟢 Low Risk (>20%)</span>
          </div>
          <div class="legend-item medium-risk">
            <div class="legend-color"></div>
            <span>🟡 Medium (10-20%)</span>
          </div>
          <div class="legend-item high-risk">
            <div class="legend-color"></div>
            <span>🔴 High Risk (<10%)</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render positions
function renderPositions() {
  const container = document.getElementById('positionsContainer');
  
  let positions = state.positions;
  
  if (currentTab === 'longs') {
    positions = positions.filter(p => p.side === 'LONG');
  } else if (currentTab === 'shorts') {
    positions = positions.filter(p => p.side === 'SHORT');
  }
  
  if (positions.length === 0) {
    container.innerHTML = '<div class="empty-state">No positions found</div>';
    return;
  }
  
  const html = positions.map(pos => {
    const currentPrice = parseFloat(state.prices[pos.asset]) || parseFloat(pos.entryPrice) || 0;
    const entryPrice = parseFloat(pos.entryPrice) || 0;
    const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 * 
      (pos.side === 'LONG' ? 1 : -1) : 0;
    const liqDistance = pos.liquidationPx ? 
      Math.abs((currentPrice - parseFloat(pos.liquidationPx)) / currentPrice * 100) : 0;
    
    return `
      <div class="position-card">
        <div class="position-header">
          <span class="position-asset">${pos.asset}</span>
          <span class="position-side ${pos.side}">${pos.side}</span>
        </div>
        <div class="position-details">
          <div class="detail-row">
            <span class="detail-label">Size:</span>
            <span class="detail-value">${Math.abs(pos.size).toFixed(4)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Notional:</span>
            <span class="detail-value">$${formatNumber(pos.positionValue)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Entry:</span>
            <span class="detail-value">$${entryPrice.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Current:</span>
            <span class="detail-value">$${currentPrice.toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Leverage:</span>
            <span class="detail-value">${(parseFloat(pos.leverage) || 0).toFixed(2)}x</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">PnL:</span>
            <span class="detail-value ${pnlPercent >= 0 ? 'positive' : 'negative'}">
              ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Liq Price:</span>
            <span class="detail-value ${liqDistance < 10 ? 'warning' : ''}">
              $${pos.liquidationPx ? parseFloat(pos.liquidationPx).toFixed(2) : 'N/A'}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Distance:</span>
            <span class="detail-value ${liqDistance < 10 ? 'warning' : ''}">
              ${liqDistance.toFixed(2)}%
            </span>
          </div>
        </div>
        <div class="position-address">
          <span class="wallet-link" onclick="copyAddress('${pos.address}')" title="Click to copy address">
            Wallet: ${pos.address ? pos.address.slice(0, 10) + '...' + pos.address.slice(-8) : 'Unknown'}
          </span>
          ${pos.address ? `<a href="https://app.hyperliquid.xyz/explorer/account?address=${pos.address}" target="_blank" class="explorer-link" title="View on Hyperliquid Explorer">🔗</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Render alerts
function renderAlerts() {
  const container = document.getElementById('alertsContainer');
  
  if (state.alerts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="margin-bottom: 20px;">
          <h3>🚨 Live Alerts</h3>
          <p>Real-time liquidation and whale activity alerts</p>
        </div>
        <div style="color: #888; font-size: 14px;">
          <p>📊 <strong>Alert Types:</strong></p>
          <ul style="text-align: left; margin: 10px 0;">
            <li>🔥 <strong>Liquidations</strong> - Immediate alerts when positions get liquidated</li>
            <li>🐋 <strong>Whale Activity</strong> - Large position opens/closes</li>
            <li>⚠️ <strong>Risk Alerts</strong> - Positions near liquidation</li>
            <li>💰 <strong>Large Positions</strong> - Million+ dollar trades</li>
          </ul>
          <p style="margin-top: 15px;">⏳ <em>Waiting for alerts...</em></p>
        </div>
      </div>
    `;
    return;
  }
  
  const html = state.alerts.reverse().slice(0, 20).map(alert => {
    const timestamp = new Date(alert.timestamp).toLocaleTimeString();
    const timeAgo = getTimeAgo(alert.timestamp);
    
    // Special formatting for liquidation alerts
    if (alert.type === 'LIQUIDATION') {
      const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
      const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
      const notionalFormatted = formatLargeNumber(alert.notional || alert.notionalValue || 0);
      
      return `
        <div class="alert-card liquidation-alert">
          <div class="alert-header liquidation-header">
            <div class="alert-title-section">
              <span class="alert-icon">🔥</span>
              <span class="alert-title">LIQUIDATION ALERT</span>
            </div>
            <span class="alert-time">${timeAgo}</span>
          </div>
          <div class="liquidation-content">
            <div class="liquidation-main">
              <span class="liquidation-wallet">
                <span class="wallet-link" onclick="copyAddress('${alert.address}')" title="Click to copy">
                  ${alert.address.slice(0, 10)}...${alert.address.slice(-8)}
                </span>
                <a href="https://app.hyperliquid.xyz/explorer/account?address=${alert.address}" target="_blank" class="explorer-link" title="View on Hyperliquid">🔗</a>
              </span>
              <div class="liquidation-details">
                <span class="asset-tag">#${alert.asset}</span>
                <span class="side-indicator ${alert.side.toLowerCase()}">
                  ${sideEmoji} ${sideText} Liquidated
                </span>
                <span class="notional-amount">$${notionalFormatted}</span>
                <span class="liquidation-price">at $${alert.liquidationPrice.toFixed(2)}</span>
              </div>
            </div>
            <div class="liquidation-meta">
              ${alert.entryPrice ? `<span>Entry: $${alert.entryPrice.toFixed(2)}</span>` : ''}
              ${alert.leverage ? `<span>${alert.leverage.toFixed(1)}x</span>` : ''}
              ${alert.pnl ? `<span class="${alert.pnl >= 0 ? 'positive' : 'negative'}">PnL: ${alert.pnl >= 0 ? '+' : ''}${alert.pnl.toFixed(2)}%</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }
    
    // Default formatting for other alerts
    return `
      <div class="alert-card ${alert.type.toLowerCase().replace(/_/g, '-')}">
        <div class="alert-header">
          <div class="alert-title-section">
            <span class="alert-icon">${getAlertIcon(alert.type)}</span>
            <span class="alert-title">${alert.type.replace(/_/g, ' ')}</span>
          </div>
          <span class="alert-time">${timeAgo}</span>
        </div>
        <div class="alert-details">
          ${alert.asset ? `
            <div class="detail-row">
              <span class="detail-label">Asset:</span>
              <span class="detail-value">${alert.asset}</span>
            </div>
          ` : ''}
          ${alert.side ? `
            <div class="detail-row">
              <span class="detail-label">Side:</span>
              <span class="detail-value ${alert.side.toLowerCase()}">${alert.side}</span>
            </div>
          ` : ''}
          ${alert.notionalValue ? `
            <div class="detail-row">
              <span class="detail-label">Notional:</span>
              <span class="detail-value">$${formatLargeNumber(alert.notionalValue)}</span>
            </div>
          ` : ''}
          ${alert.leverage ? `
            <div class="detail-row">
              <span class="detail-label">Leverage:</span>
              <span class="detail-value">${alert.leverage.toFixed(2)}x</span>
            </div>
          ` : ''}
          ${alert.address ? `
            <div class="detail-row">
              <span class="detail-label">Wallet:</span>
              <span class="detail-value">
                <span class="wallet-link" onclick="copyAddress('${alert.address}')" title="Click to copy">
                  ${alert.address.slice(0, 10)}...${alert.address.slice(-8)}
                </span>
                <a href="https://app.hyperliquid.xyz/explorer/account?address=${alert.address}" target="_blank" class="explorer-link" title="View on Hyperliquid">🔗</a>
              </span>
            </div>
          ` : ''}
        </div>
        ${alert.message ? `<div class="alert-message">${alert.message}</div>` : ''}
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Helper function to format large numbers
function formatLargeNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toFixed(0);
}

// Helper function to get time ago
function getTimeAgo(timestamp) {
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

// Render whales
function renderWhales() {
  const container = document.getElementById('whalesContainer');
  
  if (state.whales.length === 0) {
    container.innerHTML = '<div class="empty-state">No whale data available yet</div>';
    return;
  }
  
  const html = state.whales.map((whale, index) => {
    return `
      <div class="whale-card">
        <div class="whale-header">
          <span style="font-weight: bold; color: #00ff41;">${index + 1}.</span>
          <span class="detail-value ${whale.roi >= 0 ? 'positive' : 'negative'}">
            ${whale.roi >= 0 ? '+' : ''}${whale.roi.toFixed(2)}% ROI
          </span>
        </div>
        <div class="whale-details">
          <div class="detail-row">
            <span class="detail-label">Total PnL:</span>
            <span class="detail-value ${whale.totalPnL >= 0 ? 'positive' : 'negative'}">
              ${whale.totalPnL >= 0 ? '+' : ''}$${formatNumber(Math.abs(whale.totalPnL))}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Margin:</span>
            <span class="detail-value">$${formatNumber(whale.marginUsed)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Trades:</span>
            <span class="detail-value">${whale.totalTrades}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Realized:</span>
            <span class="detail-value ${whale.realizedPnL >= 0 ? 'positive' : 'negative'}">
              ${whale.realizedPnL >= 0 ? '+' : ''}$${formatNumber(Math.abs(whale.realizedPnL))}
            </span>
          </div>
        </div>
        <div class="whale-address">
          <span class="wallet-link" onclick="copyAddress('${whale.address}')" title="Click to copy address">
            ${whale.address.slice(0, 10)}...${whale.address.slice(-8)}
          </span>
          <a href="https://app.hyperliquid.xyz/explorer/account?address=${whale.address}" target="_blank" class="explorer-link" title="View on Hyperliquid Explorer">🔗</a>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Populate asset select
function populateAssetSelect() {
  const select = document.getElementById('assetSelect');
  
  if (!state.heatmap || !state.heatmap.assets) return;
  
  const options = state.heatmap.assets.map(a => 
    `<option value="${a.asset}">${a.asset}</option>`
  ).join('');
  
  select.innerHTML = '<option value="">All Assets (Global)</option>' + options;
}

// Event listeners
function setupEventListeners() {
  document.getElementById('assetSelect').addEventListener('change', renderHeatmap);
}

// Tab switching
function showTab(tab) {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderPositions();
}

// Refresh data
async function refreshData() {
  await fetchInitialData();
}

// Utility functions
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

function getAlertIcon(type) {
  const icons = {
    'WHALE_OPEN': '🐋',
    'WHALE_CLOSE': '🐋',
    'LIQUIDATION_RISK': '⚠️',
    'LARGE_POSITION': '💰',
    'CLUSTER_ALERT': '🔥'
  };
  return icons[type] || '📢';
}

// Copy address to clipboard function
function copyAddress(address) {
  navigator.clipboard.writeText(address).then(() => {
    // Show a temporary success message
    const originalText = event.target.textContent;
    event.target.textContent = 'Copied!';
    event.target.style.color = '#00ff41';
    
    setTimeout(() => {
      event.target.textContent = originalText;
      event.target.style.color = '';
    }, 1000);
  }).catch(err => {
    console.error('Failed to copy address:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = address;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    event.target.textContent = 'Copied!';
    event.target.style.color = '#00ff41';
    setTimeout(() => {
      event.target.textContent = address.slice(0, 10) + '...' + address.slice(-8);
      event.target.style.color = '';
    }, 1000);
  });
}

// Render discovery stats
function renderDiscoveryStats() {
  const container = document.getElementById('discoveryLog');
  const lastDiscoveryEl = document.getElementById('lastDiscovery');
  const addressesFoundEl = document.getElementById('addressesFound');
  const newlyAddedEl = document.getElementById('newlyAdded');
  
  if (state.stats?.discoveryStats) {
    const stats = state.stats.discoveryStats;
    
    // Update stats
    if (stats.lastDiscovery) {
      const lastTime = new Date(stats.lastDiscovery).toLocaleTimeString();
      lastDiscoveryEl.textContent = lastTime;
    }
    
    addressesFoundEl.textContent = stats.totalFound || 0;
    newlyAddedEl.textContent = stats.totalAdded || 0;
    
    // Create discovery log entries
    let logHTML = '';
    
    if (stats.lastFound > 0) {
      logHTML += `
        <div class="discovery-entry info">
          <span class="discovery-timestamp">${new Date().toLocaleTimeString()}</span>
          Found ${stats.lastFound} active addresses from recent trades
        </div>
      `;
    }
    
    if (stats.lastAdded > 0) {
      logHTML += `
        <div class="discovery-entry success">
          <span class="discovery-timestamp">${new Date().toLocaleTimeString()}</span>
          Added ${stats.lastAdded} new addresses to tracking
        </div>
      `;
    }
    
    if (logHTML) {
      container.innerHTML = logHTML;
    } else {
      container.innerHTML = '<div class="loading">Waiting for discovery data...</div>';
    }
  } else {
    container.innerHTML = '<div class="loading">Waiting for discovery data...</div>';
  }
}

// Render digest stats
function renderDigestStats() {
  if (!state.digestStats) return;
  
  const stats = state.digestStats;
  
  // Update activity stats
  document.getElementById('sevenMinVolume').textContent = `$${formatLargeNumber(stats.volume || 0)}`;
  document.getElementById('sevenMinLongs').textContent = `${stats.longsCount || 0} ($${formatLargeNumber(stats.longsValue || 0)})`;
  document.getElementById('sevenMinShorts').textContent = `${stats.shortsCount || 0} ($${formatLargeNumber(stats.shortsValue || 0)})`;
  document.getElementById('sevenMinLeverage').textContent = `${(stats.maxLeverage || 0).toFixed(1)}x`;
  document.getElementById('sevenMinAtRisk').textContent = `${stats.atRiskCount || 0} positions`;
  
  // Render closest to liquidation
  const closestContainer = document.getElementById('closestToLiq');
  
  if (stats.closestToLiq && stats.closestToLiq.length > 0) {
    const closestHTML = stats.closestToLiq.map(risk => {
      const riskClass = risk.percentFromLiquidation < 5 ? 'high-risk' : 
                       risk.percentFromLiquidation < 10 ? 'medium-risk' : '';
      
      return `
        <div class="risk-entry ${riskClass}">
          <span class="wallet-link" onclick="copyAddress('${risk.address}')" title="Click to copy">
            ${risk.address.slice(0, 8)}...${risk.address.slice(-6)}
          </span>
          <span>${risk.asset} ${risk.side} ${risk.percentFromLiquidation.toFixed(1)}% away</span>
        </div>
      `;
    }).join('');
    
    closestContainer.innerHTML = closestHTML;
  } else {
    closestContainer.innerHTML = '<div class="loading">No positions at risk currently</div>';
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

