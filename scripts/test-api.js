#!/usr/bin/env node

/**
 * Test script to verify Hyperliquid API connectivity
 * Usage: node scripts/test-api.js
 */

import { HyperliquidAPI } from '../src/api/hyperliquid.js';
import chalk from 'chalk';

async function testAPI() {
  console.log(chalk.cyan.bold('\n🧪 Testing Hyperliquid API Connection...\n'));

  const api = new HyperliquidAPI();

  try {
    // Test 1: Get market metadata
    console.log(chalk.yellow('Test 1: Fetching market metadata...'));
    const meta = await api.getMeta();
    if (meta && meta.universe) {
      console.log(chalk.green(`✓ Success! Found ${meta.universe.length} markets`));
      console.log(chalk.gray(`  Available markets: ${meta.universe.slice(0, 10).map(m => m.name).join(', ')}...`));
    } else {
      console.log(chalk.red('✗ Failed to fetch metadata'));
      return false;
    }

    // Test 2: Get current prices
    console.log(chalk.yellow('\nTest 2: Fetching current prices...'));
    const prices = await api.getAllMids();
    if (prices && Object.keys(prices).length > 0) {
      const samplePrices = Object.entries(prices).slice(0, 5);
      console.log(chalk.green(`✓ Success! Got prices for ${Object.keys(prices).length} assets`));
      samplePrices.forEach(([asset, price]) => {
        console.log(chalk.gray(`  ${asset}: $${parseFloat(price).toFixed(2)}`));
      });
    } else {
      console.log(chalk.red('✗ Failed to fetch prices'));
      return false;
    }

    // Test 3: Get recent trades
    console.log(chalk.yellow('\nTest 3: Fetching recent trades for BTC...'));
    const trades = await api.getRecentTrades('BTC');
    if (trades && trades.length > 0) {
      console.log(chalk.green(`✓ Success! Found ${trades.length} recent trades`));
      const lastTrade = trades[0];
      console.log(chalk.gray(`  Last trade: ${lastTrade.side} ${lastTrade.sz} @ $${lastTrade.px}`));
    } else {
      console.log(chalk.red('✗ Failed to fetch trades'));
      return false;
    }

    // Test 4: Get order book
    console.log(chalk.yellow('\nTest 4: Fetching order book for ETH...'));
    const book = await api.getL2Book('ETH');
    if (book && book.levels) {
      const bids = book.levels[0]?.length || 0;
      const asks = book.levels[1]?.length || 0;
      console.log(chalk.green(`✓ Success! Order book has ${bids} bids and ${asks} asks`));
      if (bids > 0 && asks > 0) {
        const bestBid = book.levels[0][0];
        const bestAsk = book.levels[1][0];
        console.log(chalk.gray(`  Best bid: $${bestBid.px} (${bestBid.sz})`));
        console.log(chalk.gray(`  Best ask: $${bestAsk.px} (${bestAsk.sz})`));
      }
    } else {
      console.log(chalk.red('✗ Failed to fetch order book'));
      return false;
    }

    console.log(chalk.green.bold('\n✅ All API tests passed! System is ready to use.\n'));
    return true;

  } catch (error) {
    console.log(chalk.red.bold('\n❌ API test failed:'), error.message);
    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log(chalk.gray('  1. Check your internet connection'));
    console.log(chalk.gray('  2. Verify Hyperliquid API is accessible'));
    console.log(chalk.gray('  3. Try: curl https://api.hyperliquid.xyz/info'));
    console.log(chalk.gray('  4. Check for firewall/proxy issues\n'));
    return false;
  }
}

testAPI();

