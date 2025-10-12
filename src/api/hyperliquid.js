import axios from 'axios';

export class HyperliquidAPI {
  constructor(apiUrl = 'https://api.hyperliquid.xyz') {
    this.apiUrl = apiUrl;
    this.client = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' }
    });
    this.requestDelay = 500; // 500ms between requests to avoid rate limits
    this.lastRequestTime = 0;
  }

  /**
   * Rate limiting helper
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get user state including positions and margin
   */
  async getUserState(address) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/info', {
        type: 'clearinghouseState',
        user: address
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited - wait longer
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      // Don't log rate limit errors (too noisy)
      if (error.response?.status !== 429) {
        console.error(`Error fetching user state for ${address}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get batch clearinghouse states for multiple addresses
   */
  async getBatchClearinghouseStates(addresses) {
    try {
      const promises = addresses.map(addr => this.getUserState(addr));
      const results = await Promise.allSettled(promises);
      return results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
    } catch (error) {
      console.error('Error fetching batch clearinghouse states:', error.message);
      return [];
    }
  }

  /**
   * Get user fills (trade history) for profitability analysis
   */
  async getUserFills(address, aggregateByTime = false) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/info', {
        type: 'userFills',
        user: address,
        aggregateByTime
      });
      return response.data || [];
    } catch (error) {
      if (error.response?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      // Don't log rate limit errors
      if (error.response?.status !== 429) {
        console.error(`Error fetching fills for ${address}:`, error.message);
      }
      return [];
    }
  }

  /**
   * Get meta info about all available assets
   */
  async getMeta() {
    try {
      const response = await this.client.post('/info', {
        type: 'meta'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching meta:', error.message);
      return null;
    }
  }

  /**
   * Get all mids (market prices)
   */
  async getAllMids() {
    try {
      const response = await this.client.post('/info', {
        type: 'allMids'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching mids:', error.message);
      return {};
    }
  }

  /**
   * Get L2 order book for a specific coin
   */
  async getL2Book(coin) {
    try {
      const response = await this.client.post('/info', {
        type: 'l2Book',
        coin
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching L2 book for ${coin}:`, error.message);
      return null;
    }
  }

  /**
   * Get open orders for a user
   */
  async getOpenOrders(address) {
    try {
      const response = await this.client.post('/info', {
        type: 'openOrders',
        user: address
      });
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching open orders for ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Get funding history for analysis
   */
  async getFundingHistory(coin, startTime, endTime) {
    try {
      const response = await this.client.post('/info', {
        type: 'fundingHistory',
        coin,
        startTime,
        endTime
      });
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching funding history for ${coin}:`, error.message);
      return [];
    }
  }

  /**
   * Get user funding payments
   */
  async getUserFunding(address, startTime, endTime) {
    try {
      const response = await this.client.post('/info', {
        type: 'userFunding',
        user: address,
        startTime,
        endTime
      });
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching user funding for ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Get recent trades for a coin
   */
  async getRecentTrades(coin) {
    try {
      const response = await this.client.post('/info', {
        type: 'recentTrades',
        coin
      });
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching recent trades for ${coin}:`, error.message);
      return [];
    }
  }

  /**
   * Scan for large positions across known addresses
   */
  async scanForWhalePositions(addresses, minPositionSize = 50000) {
    const states = await this.getBatchClearinghouseStates(addresses);
    const whalePositions = [];

    for (const state of states) {
      if (!state || !state.assetPositions) continue;

      for (const position of state.assetPositions) {
        const positionValue = Math.abs(parseFloat(position.position.szi) * parseFloat(position.position.entryPx));
        
        if (positionValue >= minPositionSize) {
          whalePositions.push({
            address: state.user || position.user,
            asset: position.position.coin,
            size: parseFloat(position.position.szi),
            entryPrice: parseFloat(position.position.entryPx),
            leverage: parseFloat(position.position.leverage?.value || 1),
            positionValue,
            side: parseFloat(position.position.szi) > 0 ? 'LONG' : 'SHORT',
            unrealizedPnl: parseFloat(position.position.unrealizedPnl || 0),
            marginUsed: parseFloat(position.position.marginUsed || 0),
            liquidationPx: parseFloat(position.position.liquidationPx || 0),
            timestamp: Date.now()
          });
        }
      }
    }

    return whalePositions;
  }
}

