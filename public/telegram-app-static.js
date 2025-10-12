// Static Telegram WebApp - Direct Hyperliquid API Integration
class StaticTelegramWhaleTracker {
  constructor() {
    this.tg = window.Telegram?.WebApp;
    this.addresses = [];
    this.positions = [];
    this.hyperliquidAPI = 'https://api.hyperliquid.xyz/info';
    this.init();
  }

  async init() {
    // Initialize Telegram WebApp
    if (this.tg) {
      this.tg.ready();
      this.tg.expand();
      
      // Set theme colors
      document.body.style.setProperty('--tg-theme-bg-color', this.tg.themeParams.bg_color || '#0a0e1a');
      document.body.style.setProperty('--tg-theme-text-color', this.tg.themeParams.text_color || '#00ff41');
    }

    this.updateStatus('Loading...', 'connecting');
    
    // Load whale addresses from localStorage or use defaults
    await this.loadWhaleAddresses();
    
    // Fetch initial data
    await this.fetchAllData();
    
    // Update every 30 seconds
    setInterval(() => this.fetchAllData(), 30000);
  }

  async loadWhaleAddresses() {
    // Try to load from localStorage
    const stored = localStorage.getItem('whaleAddresses');
    if (stored) {
      this.addresses = JSON.parse(stored);
    } else {
      // Default addresses (you can add more)
      this.addresses = [
        '0x3be628815f8caae6de1980745a0bf9a19b63bcf7',
        '0x00a5d88490c27c1fe4c2e034c5dfa0364ee6dfb6',
        '0x010046470d73f6d66f2f3f0b13b47f66b724d499'
      ];
      localStorage.setItem('whaleAddresses', JSON.stringify(this.addresses));
    }
    
    console.log(`Loaded ${this.addresses.length} whale addresses`);
  }

  async fetchAllData() {
    try {
      this.updateStatus('Fetching data...', 'connecting');
      
      // Fetch positions for all addresses
      const positions = [];
      for (const address of this.addresses.slice(0, 10)) { // Limit to 10 for demo
        try {
          const userState = await this.fetchUserState(address);
          if (userState && userState.assetPositions) {
            userState.assetPositions.forEach(pos => {
              if (pos.position && pos.position.szi !== '0') {
                positions.push({
                  address: address,
                  asset: pos.position.coin,
                  side: parseFloat(pos.position.szi) > 0 ? 'LONG' : 'SHORT',
                  size: Math.abs(parseFloat(pos.position.szi)),
                  entryPrice: parseFloat(pos.position.entryPx),
                  liquidationPx: pos.position.liquidationPx ? parseFloat(pos.position.liquidationPx) : null,
                  leverage: parseFloat(pos.position.leverage?.value || 1),
                  unrealizedPnl: parseFloat(pos.position.unrealizedPnl || 0),
                  positionValue: parseFloat(pos.position.positionValue || 0)
                });
              }
            });
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error fetching ${address}:`, error.message);
        }
      }
      
      this.positions = positions;
      this.updateUI();
      this.updateStatus('Connected', 'connected');
      
    } catch (error) {
      console.error('Error fetching data:', error);
      this.updateStatus('Error', 'error');
    }
  }

  async fetchUserState(address) {
    try {
      const response = await fetch(this.hyperliquidAPI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: address
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching user state for ${address}:`, error);
      return null;
    }
  }

  updateUI() {
    this.updateStats();
    this.renderPositions();
    this.renderAlerts();
  }

  updateStats() {
    document.getElementById('whalesCount').textContent = this.addresses.length;
    document.getElementById('positionsCount').textContent = this.positions.length;
    
    const totalValue = this.positions.reduce((sum, pos) => sum + (pos.positionValue || 0), 0);
    document.getElementById('riskValue').textContent = this.formatLargeNumber(totalValue);
  }

  renderPositions() {
    const container = document.getElementById('positionsFeed');
    
    if (this.positions.length === 0) {
      container.innerHTML = `
        <div class="position-item">
          <div class="position-header">
            <span class="position-asset">#LOADING</span>
            <span class="position-side">...</span>
            <span class="position-value">$0</span>
          </div>
          <div class="position-details">
            <span>Loading whale positions...</span>
          </div>
        </div>
      `;
      return;
    }

    const positionsHTML = this.positions.slice(0, 20).map(pos => {
      const sideClass = pos.side.toLowerCase();
      const distance = pos.liquidationPx ? 
        Math.abs((pos.entryPrice - pos.liquidationPx) / pos.entryPrice * 100) : 0;
      
      return `
        <div class="position-item">
          <div class="position-header">
            <span class="position-asset">#${pos.asset}</span>
            <span class="position-side ${sideClass}">${pos.side}</span>
            <span class="position-value">$${this.formatLargeNumber(pos.positionValue)}</span>
          </div>
          <div class="position-details">
            <span>${pos.leverage.toFixed(1)}x leverage</span>
            <span>${distance.toFixed(1)}% to liquidation</span>
          </div>
          <div class="position-pnl" style="color: ${pos.unrealizedPnl >= 0 ? '#00ff41' : '#ff4444'}">
            ${pos.unrealizedPnl >= 0 ? '+' : ''}$${this.formatLargeNumber(pos.unrealizedPnl)}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = positionsHTML;
  }

  renderAlerts() {
    const container = document.getElementById('alertsFeed');
    
    // Show positions at risk
    const atRisk = this.positions.filter(pos => {
      if (!pos.liquidationPx) return false;
      const distance = Math.abs((pos.entryPrice - pos.liquidationPx) / pos.entryPrice * 100);
      return distance < 10; // Less than 10% to liquidation
    });

    if (atRisk.length === 0) {
      container.innerHTML = `
        <div class="alert-item">
          <div class="alert-icon">✅</div>
          <div class="alert-content">
            <div class="alert-title">All positions safe</div>
            <div class="alert-subtitle">No liquidation risks detected</div>
          </div>
        </div>
      `;
      return;
    }

    const alertsHTML = atRisk.map(pos => {
      const distance = Math.abs((pos.entryPrice - pos.liquidationPx) / pos.entryPrice * 100);
      return `
        <div class="alert-item liquidation-alert">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <div class="alert-title">${pos.asset} ${pos.side} at risk</div>
            <div class="alert-subtitle">${distance.toFixed(1)}% from liquidation ($${this.formatLargeNumber(pos.positionValue)})</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = alertsHTML;
  }

  updateStatus(text, type) {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;
    
    const dot = indicator.querySelector('.status-dot');
    const textEl = indicator.querySelector('span:last-child');
    
    if (textEl) textEl.textContent = text;
    if (dot) dot.className = `status-dot ${type}`;
  }

  formatLargeNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new StaticTelegramWhaleTracker();
});
