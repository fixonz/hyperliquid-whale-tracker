#!/usr/bin/env node

/**
 * Hyperlens.io API Usage Examples
 * 
 * This file demonstrates how to use all the Hyperlens.io API endpoints
 * for liquidation monitoring, whale tracking, and portfolio analysis.
 */

import { HyperlensAPI } from '../src/api/hyperlens.js';

// Example whale addresses (replace with real addresses)
const WHALE_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222'
];

const COINS_TO_MONITOR = ['ETH', 'BTC', 'SOL', 'ARB'];

async function exampleBasicUsage() {
  console.log('🔍 Basic Hyperlens.io API Usage Examples\n');
  
  const api = new HyperlensAPI();
  
  // 1. Get global stats
  console.log('1. Getting global stats...');
  const globalStats = await api.getGlobalStats();
  console.log('Global Stats:', globalStats);
  
  // 2. Get latest liquidations
  console.log('\n2. Getting latest liquidations...');
  const latestLiquidations = await api.getLatestLiquidations();
  console.log('Latest Liquidations:', latestLiquidations);
  
  // 3. Get fills with query parameters
  console.log('\n3. Getting fills...');
  const fills = await api.getFills({
    limit: 50,
    // Add other query parameters as needed
  });
  console.log('Fills:', fills);
}

async function exampleWhaleTracking() {
  console.log('\n🐋 Whale Tracking Examples\n');
  
  const api = new HyperlensAPI();
  
  // Track a single whale
  console.log('1. Tracking individual whale...');
  const whaleData = await api.getWhaleData(WHALE_ADDRESSES[0]);
  console.log('Whale Data:', whaleData);
  
  // Batch track multiple whales
  console.log('\n2. Batch tracking multiple whales...');
  const batchStats = await api.getBatchAddressData(WHALE_ADDRESSES, 'stats');
  console.log('Batch Stats:', batchStats);
  
  // Get whale performance by coin
  console.log('\n3. Whale performance by coin...');
  for (const coin of COINS_TO_MONITOR.slice(0, 2)) {
    const performance = await api.getAddressPerformanceByCoin(WHALE_ADDRESSES[0], coin);
    console.log(`Performance on ${coin}:`, performance);
  }
}

async function exampleLiquidationAnalysis() {
  console.log('\n💥 Liquidation Analysis Examples\n');
  
  const api = new HyperlensAPI();
  
  // Get liquidations with filters
  console.log('1. Getting liquidations with filters...');
  const liquidations = await api.getLiquidations({
    limit: 100,
    // Add time filters, coin filters, etc.
  });
  console.log('Filtered Liquidations:', liquidations);
  
  // Get whale liquidations by coin
  console.log('\n2. Whale liquidations by coin...');
  for (const coin of COINS_TO_MONITOR.slice(0, 2)) {
    const liquidations = await api.getAddressLiquidationsByCoin(WHALE_ADDRESSES[0], coin);
    console.log(`Liquidations on ${coin}:`, liquidations);
  }
  
  // Get best/worst trades
  console.log('\n3. Best/worst trades...');
  const trades = await api.getBestWorstTrades(WHALE_ADDRESSES[0]);
  console.log('Best/Worst Trades:', trades);
}

async function examplePortfolioAnalysis() {
  console.log('\n📊 Portfolio Analysis Examples\n');
  
  const api = new HyperlensAPI();
  
  // Get portfolio data
  console.log('1. Getting portfolio data...');
  const portfolio = await api.getPortfolioData(WHALE_ADDRESSES[0]);
  console.log('Portfolio:', portfolio);
  
  // Get positions data
  console.log('\n2. Getting positions data...');
  const positions = await api.getPositionsData(WHALE_ADDRESSES[0]);
  console.log('Positions:', positions);
  
  // Get detailed stats
  console.log('\n3. Getting detailed stats...');
  const stats = await api.getAddressStats(WHALE_ADDRESSES[0]);
  console.log('Detailed Stats:', stats);
  
  // Get summarized stats
  console.log('\n4. Getting summarized stats...');
  const summary = await api.getAddressStatsSummary(WHALE_ADDRESSES[0]);
  console.log('Summarized Stats:', summary);
}

async function exampleRealTimeMonitoring() {
  console.log('\n📡 Real-time Monitoring Example\n');
  
  const api = new HyperlensAPI();
  
  // Monitor liquidations in real-time
  console.log('Starting liquidation monitoring...');
  
  const monitor = await api.monitorLiquidations(10000, (liquidations) => {
    console.log('🚨 New liquidations detected:', liquidations);
    
    // Process liquidations
    if (liquidations && liquidations.length > 0) {
      liquidations.forEach(liquidation => {
        console.log(`💥 Liquidation: ${liquidation.address} - ${liquidation.coin} - $${liquidation.value}`);
      });
    }
  });
  
  console.log('Monitoring started. Will run for 30 seconds...');
  
  // Stop after 30 seconds
  setTimeout(() => {
    monitor.stop();
    console.log('✅ Monitoring stopped');
  }, 30000);
}

async function exampleAdvancedQueries() {
  console.log('\n🔧 Advanced Query Examples\n');
  
  const api = new HyperlensAPI();
  
  // Example with custom query parameters
  console.log('1. Custom fills query...');
  const customFills = await api.getFills({
    limit: 25,
    offset: 0,
    // Add more specific filters based on API documentation
  });
  console.log('Custom Fills:', customFills);
  
  // Example with time-based queries
  console.log('\n2. Time-based liquidations query...');
  const timeBasedLiquidations = await api.getLiquidations({
    startTime: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
    endTime: Date.now(),
    limit: 50
  });
  console.log('Time-based Liquidations:', timeBasedLiquidations);
  
  // Example comprehensive whale analysis
  console.log('\n3. Comprehensive whale analysis...');
  const comprehensiveAnalysis = await Promise.allSettled([
    api.getAddressStats(WHALE_ADDRESSES[0]),
    api.getAddressStatsSummary(WHALE_ADDRESSES[0]),
    api.getPortfolioData(WHALE_ADDRESSES[0]),
    api.getPositionsData(WHALE_ADDRESSES[0]),
    api.getBestWorstTrades(WHALE_ADDRESSES[0])
  ]);
  
  const analysis = {
    stats: comprehensiveAnalysis[0].value,
    summary: comprehensiveAnalysis[1].value,
    portfolio: comprehensiveAnalysis[2].value,
    positions: comprehensiveAnalysis[3].value,
    trades: comprehensiveAnalysis[4].value
  };
  
  console.log('Comprehensive Analysis:', analysis);
}

async function exampleErrorHandling() {
  console.log('\n⚠️ Error Handling Examples\n');
  
  const api = new HyperlensAPI();
  
  // Test with invalid address
  console.log('1. Testing with invalid address...');
  const invalidResult = await api.getAddressStats('invalid-address');
  console.log('Invalid address result:', invalidResult);
  
  // Test with invalid coin
  console.log('\n2. Testing with invalid coin...');
  const invalidCoinResult = await api.getAddressPerformanceByCoin(WHALE_ADDRESSES[0], 'INVALID_COIN');
  console.log('Invalid coin result:', invalidCoinResult);
  
  // Test rate limiting
  console.log('\n3. Testing rate limiting...');
  const promises = Array(10).fill().map(() => api.getGlobalStats());
  const results = await Promise.allSettled(promises);
  console.log('Rate limiting test results:', results.map(r => r.status));
}

// Main execution
async function runExamples() {
  try {
    await exampleBasicUsage();
    await exampleWhaleTracking();
    await exampleLiquidationAnalysis();
    await examplePortfolioAnalysis();
    
    // Uncomment to test real-time monitoring
    // await exampleRealTimeMonitoring();
    
    await exampleAdvancedQueries();
    await exampleErrorHandling();
    
    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export for use in other modules
export {
  exampleBasicUsage,
  exampleWhaleTracking,
  exampleLiquidationAnalysis,
  examplePortfolioAnalysis,
  exampleRealTimeMonitoring,
  exampleAdvancedQueries,
  exampleErrorHandling
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}
