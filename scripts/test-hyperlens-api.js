#!/usr/bin/env node

/**
 * Test script for Hyperlens.io API endpoints
 */

import chalk from 'chalk';
import { HyperlensAPI } from '../src/api/hyperlens.js';

const testAddress = '0x0000000000000000000000000000000000000000'; // Test address
const testCoin = 'ETH'; // Test coin

async function testEndpoint(name, testFn) {
  console.log(chalk.cyan(`\n🧪 Testing: ${name}`));
  console.log(chalk.gray('─'.repeat(50)));
  
  try {
    const startTime = Date.now();
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    if (result !== null) {
      console.log(chalk.green(`✅ Success (${duration}ms)`));
      console.log(chalk.gray(`Response: ${JSON.stringify(result).slice(0, 200)}${JSON.stringify(result).length > 200 ? '...' : ''}`));
    } else {
      console.log(chalk.yellow(`⚠️  No data returned (${duration}ms)`));
    }
    
    return result;
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
    return null;
  }
}

async function testAllEndpoints() {
  const api = new HyperlensAPI();
  
  console.log(chalk.cyan.bold('\n🚀 Testing Hyperlens.io API Endpoints\n'));
  console.log(chalk.gray(`Base URL: ${api.apiUrl}`));
  console.log(chalk.gray(`Test Address: ${testAddress}`));
  console.log(chalk.gray(`Test Coin: ${testCoin}\n`));

  const results = {};

  // Test POST endpoints
  results.fills = await testEndpoint('POST /api/v1/fills', () => 
    api.getFills({ limit: 10 })
  );

  results.liquidations = await testEndpoint('POST /api/v1/liquidations', () => 
    api.getLiquidations({ limit: 10 })
  );

  results.addressStats = await testEndpoint('POST /api/v1/address/stats', () => 
    api.getAddressStats(testAddress)
  );

  results.addressStatsSummary = await testEndpoint('POST /api/v1/address/stats/summary', () => 
    api.getAddressStatsSummary(testAddress)
  );

  results.addressPerformance = await testEndpoint('POST /api/v1/address/performance/coin', () => 
    api.getAddressPerformanceByCoin(testAddress, testCoin)
  );

  results.addressLiquidations = await testEndpoint('POST /api/v1/address/liquidations/coin', () => 
    api.getAddressLiquidationsByCoin(testAddress, testCoin)
  );

  results.bestWorstTrades = await testEndpoint('POST /api/v1/address/trades/best-worst', () => 
    api.getBestWorstTrades(testAddress)
  );

  // Test GET endpoints
  results.latestLiquidations = await testEndpoint('GET /api/v1/liquidations/latest', () => 
    api.getLatestLiquidations()
  );

  results.globalStats = await testEndpoint('GET /api/v1/global/stats', () => 
    api.getGlobalStats()
  );

  results.portfolio = await testEndpoint('GET /api/v1/portfolio/{address}', () => 
    api.getPortfolioData(testAddress)
  );

  results.positions = await testEndpoint('GET /api/v1/positions/{address}', () => 
    api.getPositionsData(testAddress)
  );

  // Test batch operations
  results.batchStats = await testEndpoint('Batch Address Stats', () => 
    api.getBatchAddressData([testAddress, '0x1111111111111111111111111111111111111111'], 'stats')
  );

  results.whaleData = await testEndpoint('Comprehensive Whale Data', () => 
    api.getWhaleData(testAddress)
  );

  // Summary
  console.log(chalk.cyan.bold('\n📊 Test Summary\n'));
  console.log(chalk.gray('─'.repeat(50)));
  
  const successful = Object.values(results).filter(r => r !== null).length;
  const total = Object.keys(results).length;
  
  console.log(chalk.green(`✅ Successful: ${successful}/${total}`));
  console.log(chalk.yellow(`⚠️  No Data: ${total - successful}/${total}`));
  
  console.log(chalk.cyan.bold('\n📋 Detailed Results:\n'));
  
  Object.entries(results).forEach(([endpoint, result]) => {
    const status = result !== null ? chalk.green('✅') : chalk.yellow('⚠️');
    console.log(`${status} ${endpoint}: ${result !== null ? 'Success' : 'No data'}`);
  });

  // Test monitoring (short test)
  console.log(chalk.cyan.bold('\n🔄 Testing Liquidation Monitoring\n'));
  console.log(chalk.gray('─'.repeat(50)));
  
  try {
    const monitor = await api.monitorLiquidations(5000, (liquidations) => {
      console.log(chalk.green('📡 New liquidations detected:'), liquidations);
    });
    
    console.log(chalk.green('✅ Monitoring started successfully'));
    console.log(chalk.gray('⏳ Waiting 10 seconds for test...'));
    
    setTimeout(() => {
      monitor.stop();
      console.log(chalk.green('✅ Monitoring test completed'));
    }, 10000);
    
  } catch (error) {
    console.log(chalk.red('❌ Monitoring test failed:'), error.message);
  }

  console.log(chalk.cyan.bold('\n🎉 All tests completed!\n'));
}

// Run tests
testAllEndpoints().catch(error => {
  console.error(chalk.red('❌ Test suite failed:'), error);
  process.exit(1);
});
