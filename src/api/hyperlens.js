import axios from 'axios';

export class HyperlensAPI {
  constructor(apiUrl = 'https://hyperlens.io') {
    this.apiUrl = apiUrl;
    this.client = axios.create({
      baseURL: apiUrl,
      headers: { 'Content-Type': 'application/json' }
    });
    this.requestDelay = 200; // 200ms between requests
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
   * POST /api/v1/fills - Get Fills
   */
  async getFills(query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/fills', query);
      return response.data;
    } catch (error) {
      console.error('Error fetching fills:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * POST /api/v1/liquidations - Get Liquidations
   */
  async getLiquidations(query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/liquidations', query);
      return response.data;
    } catch (error) {
      console.error('Error fetching liquidations:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * GET /api/v1/liquidations/latest - Get Latest Liquidations
   */
  async getLatestLiquidations() {
    await this.rateLimit();
    try {
      const response = await this.client.get('/api/v1/liquidations/latest');
      return response.data;
    } catch (error) {
      console.error('Error fetching latest liquidations:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * POST /api/v1/address/stats - Get Address Stats
   */
  async getAddressStats(address, query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/address/stats', {
        address,
        ...query
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching stats for ${address}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * POST /api/v1/address/stats/summary - Get Address Stats Summarized
   */
  async getAddressStatsSummary(address, query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/address/stats/summary', {
        address,
        ...query
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching stats summary for ${address}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * POST /api/v1/address/performance/coin - Get Address Performance By Coin
   */
  async getAddressPerformanceByCoin(address, coin, query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/address/performance/coin', {
        address,
        coin,
        ...query
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching performance for ${address} on ${coin}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * POST /api/v1/address/liquidations/coin - Get Address Liquidations By Coin
   */
  async getAddressLiquidationsByCoin(address, coin, query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/address/liquidations/coin', {
        address,
        coin,
        ...query
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching liquidations for ${address} on ${coin}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * POST /api/v1/address/trades/best-worst - Get Best Worst Trades
   */
  async getBestWorstTrades(address, query = {}) {
    await this.rateLimit();
    try {
      const response = await this.client.post('/api/v1/address/trades/best-worst', {
        address,
        ...query
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching best/worst trades for ${address}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * GET /api/v1/global/stats - Get Home Stats
   */
  async getGlobalStats() {
    await this.rateLimit();
    try {
      const response = await this.client.get('/api/v1/global/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching global stats:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * GET /api/v1/portfolio/{address} - Get Portfolio Data
   */
  async getPortfolioData(address) {
    await this.rateLimit();
    try {
      const response = await this.client.get(`/api/v1/portfolio/${address}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching portfolio data for ${address}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * GET /api/v1/positions/{address} - Get Positions Data
   */
  async getPositionsData(address) {
    await this.rateLimit();
    try {
      const response = await this.client.get(`/api/v1/positions/${address}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching positions data for ${address}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * Batch fetch data for multiple addresses
   */
  async getBatchAddressData(addresses, dataType = 'stats') {
    const results = {};
    
    for (const address of addresses) {
      try {
        let data = null;
        
        switch (dataType) {
          case 'stats':
            data = await this.getAddressStats(address);
            break;
          case 'statsSummary':
            data = await this.getAddressStatsSummary(address);
            break;
          case 'portfolio':
            data = await this.getPortfolioData(address);
            break;
          case 'positions':
            data = await this.getPositionsData(address);
            break;
          default:
            console.warn(`Unknown data type: ${dataType}`);
        }
        
        results[address] = data;
      } catch (error) {
        console.error(`Error fetching ${dataType} for ${address}:`, error.message);
        results[address] = null;
      }
    }
    
    return results;
  }

  /**
   * Get comprehensive whale data for monitoring
   */
  async getWhaleData(address) {
    try {
      const [stats, statsSummary, portfolio, positions] = await Promise.allSettled([
        this.getAddressStats(address),
        this.getAddressStatsSummary(address),
        this.getPortfolioData(address),
        this.getPositionsData(address)
      ]);

      return {
        address,
        stats: stats.status === 'fulfilled' ? stats.value : null,
        statsSummary: statsSummary.status === 'fulfilled' ? statsSummary.value : null,
        portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
        positions: positions.status === 'fulfilled' ? positions.value : null,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Error fetching comprehensive whale data for ${address}:`, error.message);
      return null;
    }
  }

  /**
   * Monitor liquidations in real-time
   */
  async monitorLiquidations(interval = 30000, callback = null) {
    let lastCheck = Date.now();
    
    const checkLiquidations = async () => {
      try {
        const liquidations = await this.getLatestLiquidations();
        
        if (liquidations && callback) {
          callback(liquidations);
        }
        
        return liquidations;
      } catch (error) {
        console.error('Error monitoring liquidations:', error.message);
        return null;
      }
    };

    // Initial check
    await checkLiquidations();
    
    // Set up interval
    const intervalId = setInterval(checkLiquidations, interval);
    
    return {
      stop: () => clearInterval(intervalId),
      check: checkLiquidations
    };
  }
}
