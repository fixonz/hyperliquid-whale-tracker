#!/usr/bin/env node

/**
 * Test Hyperliquid liquidation-related endpoints
 */

import chalk from 'chalk';

const API_URL = 'https://api.hyperliquid.xyz/info';

async function testEndpoint(name, payload) {
  console.log(chalk.cyan(`\nTesting: ${name}`));
  console.log(chalk.gray(`Payload: ${JSON.stringify(payload)}`));
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log(chalk.yellow(`Status: ${response.status}`));
    
    if (!response.ok) {
      console.log(chalk.red(`  Error: ${response.statusText}`));
      return null;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      console.log(chalk.green(`  ✓ Response: Array with ${data.length} items`));
      if (data.length > 0) {
        console.log(chalk.gray(`  Sample: ${JSON.stringify(data[0]).slice(0, 200)}`));
      }
    } else if (typeof data === 'object') {
      console.log(chalk.green(`  ✓ Response: Object with ${Object.keys(data).length} keys`));
      console.log(chalk.gray(`  Keys: ${Object.keys(data).slice(0, 10).join(', ')}`));
    } else {
      console.log(chalk.green(`  ✓ Response: ${JSON.stringify(data).slice(0, 200)}`));
    }
    
    return data;
  } catch (error) {
    console.log(chalk.red(`  Error: ${error.message}`));
    return null;
  }
}

async function main() {
  console.log(chalk.cyan.bold('\n🔍 Testing Hyperliquid Liquidation Endpoints\n'));
  
  // Test liquidation-related endpoints
  await testEndpoint('User Funding', { 
    type: 'userFunding', 
    user: '0x0000000000000000000000000000000000000000'
  });
  
  await testEndpoint('User Non-Funding Ledger', { 
    type: 'userNonFundingLedgerUpdates', 
    user: '0x0000000000000000000000000000000000000000'
  });
  
  await testEndpoint('Funding History', { 
    type: 'fundingHistory', 
    coin: 'BTC',
    startTime: Date.now() - 24 * 60 * 60 * 1000
  });
  
  // Test getting all open positions (might have liquidatable info)
  await testEndpoint('Meta and Asset Contexts', { type: 'metaAndAssetCtxs' });
  
  // Test clearinghouse state
  await testEndpoint('Clearinghouse State', { 
    type: 'clearinghouseState', 
    user: '0x0000000000000000000000000000000000000000'
  });
  
  // Try user trade volume
  await testEndpoint('User Token Volume', {
    type: 'userTokenVolume',
    user: '0x0000000000000000000000000000000000000000'
  });
  
  // Try spotMeta
  await testEndpoint('Spot Meta', { type: 'spotMeta' });
  
  // Try to get all users (long shot)
  await testEndpoint('Active Users', { type: 'activeUsers' });
  
  // Try leaderboard variations
  await testEndpoint('Leaderboard (no params)', { type: 'leaderboard' });
  await testEndpoint('Leaderboard (all time)', { type: 'leaderboard', timeWindow: 'allTime' });
  await testEndpoint('Leaderboard (day)', { type: 'leaderboard', timeWindow: 'day' });
  
  console.log(chalk.cyan.bold('\n✅ Test complete\n'));
}

main();

