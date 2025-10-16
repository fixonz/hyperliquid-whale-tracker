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
  prices: {},
  hyperlensData: {},
  enhancedAlerts: []
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
    const [stats, heatmap, positions, alerts, whales, prices, digestStats, hyperlensData, enhancedAlerts] = await Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/heatmap').then(r => r.json()),
      fetch('/api/positions').then(r => r.json()),
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/whales').then(r => r.json()),
      fetch('/api/prices').then(r => r.json()),
      fetch('/api/digest-stats').then(r => r.json()),
      fetch('/api/hyperlens-data').then(r => r.json()).catch(() => ({})),
      fetch('/api/enhanced-alerts').then(r => r.json()).catch(() => [])
    ]);
    
    state.stats = stats;
    state.heatmap = heatmap;
    state.positions = positions;
    state.alerts = alerts;
    state.whales = whales;
    state.prices = prices;
    state.digestStats = digestStats;
    state.hyperlensData = hyperlensData;
    state.enhancedAlerts = enhancedAlerts;
    
    updateStats();
    renderHeatmap();
    renderPositions();
    renderAlerts();
    renderWhales();
    renderDiscoveryStats();
    renderDigestStats();
    populateAssetSelect();
    renderHyperlensInsights();
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
            <span class="detail-value">${Math.abs(pos.size || 0).toFixed(4)} ${pos.asset}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Notional (USD Value):</span>
            <span class="detail-value">$${formatNumber(pos.positionValue || 0)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Entry:</span>
            <span class="detail-value">$${(entryPrice || 0).toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Current:</span>
            <span class="detail-value">$${(currentPrice || 0).toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Leverage:</span>
            <span class="detail-value">${(parseFloat(pos.leverage) || 0).toFixed(2)}x</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">PnL:</span>
            <span class="detail-value ${(pnlPercent || 0) >= 0 ? 'positive' : 'negative'}">
              ${(pnlPercent || 0) >= 0 ? '+' : ''}${(pnlPercent || 0).toFixed(2)}%
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Liq Price:</span>
            <span class="detail-value ${(liqDistance || 0) < 10 ? 'warning' : ''}">
              $${pos.liquidationPx ? parseFloat(pos.liquidationPx).toFixed(2) : 'N/A'}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Distance:</span>
            <span class="detail-value ${(liqDistance || 0) < 10 ? 'warning' : ''}">
              ${(liqDistance || 0).toFixed(2)}%
            </span>
          </div>
        </div>
        <div class="position-address">
          <span class="wallet-link" onclick="copyAddress('${pos.address}')" title="Click to copy address">
            Wallet: ${pos.address ? pos.address.slice(0, 10) + '...' + pos.address.slice(-8) : 'Unknown'}
          </span>
          ${pos.address ? `<a href="/summary/${pos.address}" class="hyperlens-link" title="View Summary & Liquidations">📊</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

// Render alerts
function renderAlerts() {
  const container = document.getElementById('alertsContainer');
  
  // Combine regular alerts with enhanced alerts
  const allAlerts = [...state.alerts, ...state.enhancedAlerts];
  
  if (allAlerts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="margin-bottom: 20px;">
          <h3>🚨 Live Alerts</h3>
          <p>Real-time liquidation and whale activity alerts with Hyperlens.io data</p>
        </div>
        <div style="color: #888; font-size: 14px;">
          <p>📊 <strong>Enhanced Alert Types:</strong></p>
          <ul style="text-align: left; margin: 10px 0;">
            <li>🔥 <strong>Enhanced Liquidations</strong> - With Hyperlens.io liquidation history</li>
            <li>🌊 <strong>Cascade Warnings</strong> - Multiple liquidation alerts</li>
            <li>🐋 <strong>Whale Patterns</strong> - Behavioral pattern detection</li>
            <li>⚡ <strong>Volatility Spikes</strong> - Market volatility alerts</li>
            <li>🎯 <strong>Liquidation Clusters</strong> - Risk concentration alerts</li>
            <li>💡 <strong>Hyperlens Insights</strong> - Advanced market intelligence</li>
          </ul>
          <p style="margin-top: 15px;">⏳ <em>Waiting for enhanced alerts...</em></p>
        </div>
      </div>
    `;
    return;
  }
  
  const html = allAlerts.reverse().slice(0, 20).map(alert => {
    const timestamp = new Date(alert.timestamp).toLocaleTimeString();
    const timeAgo = getTimeAgo(alert.timestamp);
    
    // Special formatting for enhanced liquidation alerts
    if (alert.type === 'ENHANCED_LIQUIDATION') {
      const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
      const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
      const notionalFormatted = formatLargeNumber(alert.notional || alert.notionalValue || 0);
      const severity = alert.severity || 'medium';
      const severityEmoji = {
        'massive': '🚨💥',
        'large': '🔥',
        'medium': '⚡',
        'small': '💥'
      };
      const isRepeat = alert.isRepeatLiquidation || false;
      
      return `
        <div class="alert-card liquidation-alert enhanced-alert">
          <div class="alert-header liquidation-header">
            <div class="alert-title-section">
              <span class="alert-icon">${severityEmoji[severity] || '🔥'}</span>
              <span class="alert-title">${severity.toUpperCase()} LIQUIDATION</span>
              ${isRepeat ? '<span style="color: #ffaa00; font-size: 12px; margin-left: 8px;">⚠️ REPEAT</span>' : ''}
            </div>
            <span class="alert-time">${timeAgo}</span>
          </div>
          <div class="liquidation-content">
            <div class="liquidation-main">
              <span class="liquidation-wallet">
                <span class="wallet-link" onclick="copyAddress('${alert.address}')" title="Click to copy">
                  ${alert.address.slice(0, 10)}...${alert.address.slice(-8)}
                </span>
                <a href="/summary/${alert.address}" class="hyperlens-link" title="View Summary & Liquidations">📊</a>
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
              ${alert.liquidationCount ? `<span>Total Liq: ${alert.liquidationCount}</span>` : ''}
            </div>
            <div style="margin-top: 8px; padding: 8px; background: rgba(0, 255, 65, 0.1); border-radius: 4px; font-size: 12px; color: #00ff41;">
              💡 Enhanced with Hyperlens.io data
            </div>
          </div>
        </div>
      `;
    }
    
    // Special formatting for cascade warnings
    if (alert.type === 'CASCADE_WARNING') {
      return `
        <div class="alert-card cascade-warning">
          <div class="alert-header" style="background: rgba(255, 68, 68, 0.2);">
            <div class="alert-title-section">
              <span class="alert-icon">🌊</span>
              <span class="alert-title">LIQUIDATION CASCADE WARNING</span>
            </div>
            <span class="alert-time">${timeAgo}</span>
          </div>
          <div class="alert-details">
            <div class="detail-row">
              <span class="detail-label">Estimated Impact:</span>
              <span class="detail-value">$${formatLargeNumber(alert.estimatedImpact)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Affected Assets:</span>
              <span class="detail-value">${alert.affectedAssets.join(', ')}</span>
            </div>
            <div style="margin-top: 8px; padding: 8px; background: rgba(255, 68, 68, 0.1); border-radius: 4px; font-size: 12px; color: #ff4444;">
              ⚠️ Multiple liquidations expected - Market impact incoming
            </div>
          </div>
        </div>
      `;
    }
    
    // Special formatting for whale patterns
    if (alert.type === 'WHALE_PATTERN') {
      return `
        <div class="alert-card whale-pattern">
          <div class="alert-header" style="background: rgba(0, 255, 65, 0.2);">
            <div class="alert-title-section">
              <span class="alert-icon">🐋</span>
              <span class="alert-title">WHALE PATTERN DETECTED</span>
            </div>
            <span class="alert-time">${timeAgo}</span>
          </div>
          <div class="alert-details">
            <div class="detail-row">
              <span class="detail-label">Pattern:</span>
              <span class="detail-value">${alert.pattern.type.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">ROI:</span>
              <span class="detail-value ${alert.whaleStats.roi >= 0 ? 'positive' : 'negative'}">
                ${alert.whaleStats.roi >= 0 ? '+' : ''}${alert.whaleStats.roi.toFixed(2)}%
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Wallet:</span>
              <span class="detail-value">
                <span class="wallet-link" onclick="copyAddress('${alert.address}')" title="Click to copy">
                  ${alert.address.slice(0, 10)}...${alert.address.slice(-8)}
                </span>
              </span>
            </div>
          </div>
        </div>
      `;
    }
    
    // Special formatting for regular liquidation alerts
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
                <a href="/summary/${alert.address}" class="hyperlens-link" title="View Summary & Liquidations">📊</a>
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
                <a href="/summary/${alert.address}" class="hyperlens-link" title="View Summary & Liquidations">📊</a>
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
    // Safe number handling with fallbacks
    const roi = isNaN(whale.roi) || whale.roi === null || whale.roi === undefined ? 0 : whale.roi;
    const totalPnL = isNaN(whale.totalPnL) || whale.totalPnL === null || whale.totalPnL === undefined ? 0 : whale.totalPnL;
    const marginUsed = isNaN(whale.marginUsed) || whale.marginUsed === null || whale.marginUsed === undefined ? 0 : whale.marginUsed;
    const totalTrades = isNaN(whale.totalTrades) || whale.totalTrades === null || whale.totalTrades === undefined ? 0 : whale.totalTrades;
    const realizedPnL = isNaN(whale.realizedPnL) || whale.realizedPnL === null || whale.realizedPnL === undefined ? 0 : whale.realizedPnL;
    
    return `
      <div class="whale-card">
        <div class="whale-header">
          <span style="font-weight: bold; color: #00ff41;">${index + 1}.</span>
          <span class="detail-value ${roi >= 0 ? 'positive' : 'negative'}">
            ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}% ROI
          </span>
        </div>
        <div class="whale-details">
          <div class="detail-row">
            <span class="detail-label">Total PnL:</span>
            <span class="detail-value ${totalPnL >= 0 ? 'positive' : 'negative'}">
              ${totalPnL >= 0 ? '+' : ''}$${formatNumber(Math.abs(totalPnL))}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Margin:</span>
            <span class="detail-value">$${formatNumber(marginUsed)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Trades:</span>
            <span class="detail-value">${totalTrades}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Realized:</span>
            <span class="detail-value ${realizedPnL >= 0 ? 'positive' : 'negative'}">
              ${realizedPnL >= 0 ? '+' : ''}$${formatNumber(Math.abs(realizedPnL))}
            </span>
          </div>
        </div>
        <div class="whale-address">
          <span class="wallet-link" onclick="copyAddress('${whale.address}')" title="Click to copy address">
            ${whale.address.slice(0, 10)}...${whale.address.slice(-8)}
          </span>
          <a href="/summary/${whale.address}" class="hyperlens-link" title="View Summary & Liquidations">📊</a>
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
  
  // Render top positions with HOT alerts
  const topPositionsContainer = document.getElementById('topPositionsList');
  
  if (stats.topPositions && stats.topPositions.length > 0) {
    const topPositionsHTML = stats.topPositions.map(pos => {
      const isHot = pos.notional >= 1000000; // $1M threshold
      const hotClass = isHot ? 'hot-position' : '';
      const hotIcon = isHot ? '🔥' : '🟢';
      
      return `
        <div class="position-entry ${hotClass}">
          <span class="position-icon">${hotIcon}</span>
          <span class="position-details">
            ${pos.asset} $${formatLargeNumber(pos.notional)} ${pos.leverage.toFixed(1)}x
            ${isHot ? '<span class="hot-badge">HOT!</span>' : ''}
          </span>
        </div>
      `;
    }).join('');
    
    topPositionsContainer.innerHTML = topPositionsHTML;
  } else {
    topPositionsContainer.innerHTML = '<div class="loading">No positions found</div>';
  }
}

// Navigation function
function scrollToSection(sectionId) {
  // Update active button
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Scroll to section
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// Render Hyperlens insights
function renderHyperlensInsights() {
  if (!state.hyperlensData || Object.keys(state.hyperlensData).length === 0) {
    return;
  }
  
  // Add Hyperlens insights to stats if available
  if (state.hyperlensData.globalStats) {
    const globalStats = state.hyperlensData.globalStats;
    // Update stats with Hyperlens data
    if (globalStats.totalLiquidations) {
      document.getElementById('totalLiquidations').textContent = globalStats.totalLiquidations;
    }
    if (globalStats.totalVolume) {
      document.getElementById('liquidationVolume').textContent = `$${formatLargeNumber(globalStats.totalVolume)}`;
    }
  }
}

// Enhanced alert icons
function getAlertIcon(type) {
  const icons = {
    'WHALE_OPEN': '🐋',
    'WHALE_CLOSE': '🐋',
    'LIQUIDATION_RISK': '⚠️',
    'LARGE_POSITION': '💰',
    'CLUSTER_ALERT': '🔥',
    'ENHANCED_LIQUIDATION': '🔥',
    'CASCADE_WARNING': '🌊',
    'WHALE_PATTERN': '🐋',
    'VOLATILITY_SPIKE': '⚡',
    'LIQUIDATION_CLUSTER': '🎯',
    'ENHANCED_RISK': '⚠️',
    'HYPERLENS_INSIGHT': '💡'
  };
  return icons[type] || '📢';
}

// Manual discovery trigger
async function triggerDiscovery() {
  const btn = document.getElementById('discoveryBtn');
  const originalText = btn.textContent;
  
  btn.textContent = '🔍 Discovering...';
  btn.disabled = true;
  
  try {
    const response = await fetch('/api/discover-addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update the stats immediately with the returned data
      if (result.totalStats) {
        state.stats = result.totalStats;
      } else if (result.stats) {
        state.stats.discoveryStats = result.stats;
      }
      
      // Update whale count directly from API response
      if (result.whalesTracked) {
        state.stats.whalesTracked = result.whalesTracked;
      }
      
      // Update all stats display immediately
      updateStats();
      renderDiscoveryStats();
      
      // Show success message
      btn.textContent = `✅ Found ${result.discovered}`;
      btn.style.background = 'rgba(0, 255, 65, 0.2)';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    } else {
      throw new Error(result.error || 'Discovery failed');
    }
    
  } catch (error) {
    console.error('Discovery error:', error);
    btn.textContent = '❌ Failed';
    btn.style.background = 'rgba(255, 68, 68, 0.2)';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
      btn.disabled = false;
    }, 3000);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

