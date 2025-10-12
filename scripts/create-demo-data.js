#!/usr/bin/env node

/**
 * Create demo whale data for testing the system
 * Usage: node scripts/create-demo-data.js
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

console.log(chalk.cyan.bold('\n🎬 Creating Demo Whale Data...\n'));

const dataDir = './data';
const whalesFile = path.join(dataDir, 'whales.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create example whale addresses (these won't have real data, but will let you test the system)
const demoWhales = {
  "0x0000000000000000000000000000000000000001": {
    address: "0x0000000000000000000000000000000000000001",
    firstSeen: Date.now(),
    totalTrades: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    totalPnL: 0,
    marginUsed: 0,
    roi: 0,
    winRate: 0,
    largestPosition: 0,
    activePositions: 0,
    lastUpdated: Date.now(),
    note: "Demo address - replace with real whale addresses"
  }
};

fs.writeFileSync(whalesFile, JSON.stringify(demoWhales, null, 2));

console.log(chalk.green('✓ Created demo whale data'));
console.log(chalk.yellow('\n⚠️  IMPORTANT: These are placeholder addresses!'));
console.log(chalk.gray('   They won\'t show real positions.\n'));

console.log(chalk.cyan.bold('📝 How to Get REAL Whale Addresses:\n'));

console.log(chalk.yellow('Option 1: Hyperliquid Leaderboard'));
console.log(chalk.gray('  1. Visit: https://app.hyperliquid.xyz/leaderboard'));
console.log(chalk.gray('  2. Copy addresses of top traders'));
console.log(chalk.gray('  3. Run: node scripts/add-whale.js 0xAddress\n'));

console.log(chalk.yellow('Option 2: Check This Public List'));
console.log(chalk.gray('  1. Join Hyperliquid Discord: https://discord.gg/hyperliquid'));
console.log(chalk.gray('  2. Check #trading or #general for whale discussions'));
console.log(chalk.gray('  3. Ask: "What are some active whale addresses?"\n'));

console.log(chalk.yellow('Option 3: Use Dune Analytics'));
console.log(chalk.gray('  1. Visit: https://dune.com'));
console.log(chalk.gray('  2. Search for "Hyperliquid" dashboards'));
console.log(chalk.gray('  3. Find dashboards showing top traders/addresses\n'));

console.log(chalk.yellow('Option 4: Monitor Live Trades'));
console.log(chalk.gray('  1. Go to Hyperliquid trading interface'));
console.log(chalk.gray('  2. Watch the trade feed for large orders'));
console.log(chalk.gray('  3. Note the trader addresses\n'));

console.log(chalk.cyan('💡 Quick Start:'));
console.log(chalk.gray('   Go to https://app.hyperliquid.xyz/leaderboard right now'));
console.log(chalk.gray('   Copy the top 5 addresses'));
console.log(chalk.gray('   Add them with: node scripts/add-whale.js 0xAddress\n'));

console.log(chalk.green('Once you have real addresses, the bot will track their positions!\n'));

