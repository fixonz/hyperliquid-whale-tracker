#!/usr/bin/env node

/**
 * Add sample Hyperliquid whale addresses
 * These are placeholder addresses - replace with real ones from:
 * - https://basehype.xyz (Hyperliquid Whale Tracker)
 * - https://hyperticker.com/terminal/ETH
 * - https://hyperticker.com/high-volume-trades
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Sample Hyperliquid addresses format
// IMPORTANT: Replace these with REAL addresses from the Hyperliquid whale trackers above
const sampleAddresses = [
  // These are example format - you need to get real ones from basehype.xyz or hyperticker.com
  '0x' + '1'.repeat(40),
  '0x' + '2'.repeat(40),
  '0x' + '3'.repeat(40),
  '0x' + '4'.repeat(40),
  '0x' + '5'.repeat(40),
];

async function addSampleWhales() {
  console.log(chalk.yellow.bold('\n⚠️  ADDING SAMPLE HYPERLIQUID ADDRESSES\n'));
  console.log(chalk.yellow('These are placeholder addresses!'));
  console.log(chalk.yellow('To get REAL whale addresses, visit:\n'));
  console.log(chalk.cyan('  1. https://basehype.xyz (Whale Tracker)'));
  console.log(chalk.cyan('  2. https://hyperticker.com/terminal/ETH (Top Wallets)'));
  console.log(chalk.cyan('  3. https://hyperticker.com/high-volume-trades (Recent Big Trades)\n'));
  console.log(chalk.yellow('Copy addresses from there and use:'));
  console.log(chalk.white('  node scripts/bulk-add-whales.js\n'));
  
  const dataDir = './data';
  const whalesFile = path.join(dataDir, 'whales.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  let whales = {};
  const now = Date.now();
  
  console.log(chalk.yellow('Adding sample addresses...\n'));
  
  for (const address of sampleAddresses) {
    whales[address] = {
      address,
      firstSeen: now,
      totalTrades: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      marginUsed: 0,
      roi: 0,
      winRate: 0,
      largestPosition: 0,
      activePositions: 0,
      lastUpdated: now,
      source: 'sample-hyperliquid',
      lastActive: null
    };
    console.log(chalk.gray(`  + ${address}`));
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${sampleAddresses.length} sample addresses`));
  console.log(chalk.yellow.bold('\n⚠️  NEXT STEPS:\n'));
  console.log(chalk.white('1. Visit: https://basehype.xyz'));
  console.log(chalk.white('2. Copy real whale addresses from the leaderboard'));
  console.log(chalk.white('3. Add them using: node scripts/bulk-add-whales.js'));
  console.log(chalk.white('4. Start monitoring: npm run dev\n'));
}

addSampleWhales().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});

