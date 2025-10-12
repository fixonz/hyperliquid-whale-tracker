/**
 * Utility for discovering whale addresses on Hyperliquid
 * 
 * Since Hyperliquid doesn't provide a direct "top traders" endpoint,
 * you need to maintain a list of addresses to track.
 * 
 * Methods to discover addresses:
 * 1. Monitor recent large trades via public trade feeds
 * 2. Track addresses from social media / leaderboards
 * 3. Analyze on-chain transfers for large deposits
 * 4. Community-maintained whale lists
 */

export class AddressDiscovery {
  constructor(api) {
    this.api = api;
    this.discoveredAddresses = new Set();
  }

  /**
   * Discover addresses from recent large trades
   */
  async discoverFromTrades(coins, minTradeSize = 100000) {
    const addresses = new Set();

    for (const coin of coins) {
      try {
        const trades = await this.api.getRecentTrades(coin);
        
        for (const trade of trades) {
          const tradeValue = parseFloat(trade.sz) * parseFloat(trade.px);
          
          if (tradeValue >= minTradeSize && trade.user) {
            addresses.add(trade.user);
          }
        }
      } catch (error) {
        console.error(`Error discovering addresses from ${coin}:`, error.message);
      }
    }

    return Array.from(addresses);
  }

  /**
   * Load addresses from external file or API
   */
  async loadWhaleList(source) {
    // This could load from:
    // - A JSON file with known whale addresses
    // - An external API that tracks whales
    // - A community-maintained list
    
    try {
      // Example: Load from local file
      // In production, this could be a database or external API
      return [];
    } catch (error) {
      console.error('Error loading whale list:', error.message);
      return [];
    }
  }

  /**
   * Get all discovered addresses
   */
  getAddresses() {
    return Array.from(this.discoveredAddresses);
  }

  /**
   * Add address manually
   */
  addAddress(address) {
    this.discoveredAddresses.add(address);
  }

  /**
   * Add multiple addresses
   */
  addAddresses(addresses) {
    addresses.forEach(addr => this.discoveredAddresses.add(addr));
  }
}

/**
 * Example whale addresses to get started
 * These should be replaced with real, actively-trading whale addresses
 */
export const EXAMPLE_WHALE_ADDRESSES = [
  // Add known whale addresses here
  // Example format:
  // '0x...',
];

