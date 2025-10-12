#!/usr/bin/env node

/**
 * Test different Hyperliquid API endpoints to find working ones
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
    
    console.log(chalk.yellow(`Status: ${response.status} ${response.statusText}`));
    
    const data = await response.json();
    console.log(chalk.green(`Response: ${JSON.stringify(data).slice(0, 200)}...`));
    
    return data;
  } catch (error) {
    console.log(chalk.red(`Error: ${error.message}`));
    return null;
  }
}

async function main() {
  console.log(chalk.cyan.bold('\n🔍 Testing Hyperliquid API Endpoints\n'));
  
  // Test different endpoint formats
  await testEndpoint('Meta (Universe)', { type: 'meta' });
  await testEndpoint('Meta Zero', { type: 'metaAndAssetCtxs' });
  await testEndpoint('All Mids', { type: 'allMids' });
  
  // Test with a known address format
  const testAddress = '0x0000000000000000000000000000000000000000';
  await testEndpoint('User State', { type: 'clearinghouseState', user: testAddress });
  await testEndpoint('User Fills', { type: 'userFills', user: testAddress });
  
  console.log(chalk.cyan.bold('\n✅ Test complete\n'));
}

main();

