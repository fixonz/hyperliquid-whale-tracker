#!/usr/bin/env node

/**
 * Add starter whale addresses to begin tracking
 * You can add more addresses from:
 * - https://app.hyperliquid.xyz/leaderboard
 * - https://www.coinglass.com/hl/range/8
 * - Or manually discover from large trades
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Starter addresses - the test address we found that has activity
// Add more real addresses here as you find them
const starterAddresses = [
  '0x0000000000000000000000000000000000000000', // Has $30k account value and active trades
];

console.log(chalk.yellow.bold('\n⚠️  IMPORTANT: Adding Starter Addresses\n'));
console.log(chalk.white('This bot needs REAL Hyperliquid trader addresses to track.\n'));
console.log(chalk.cyan('To find whale addresses:'));
console.log(chalk.white('1. Visit: https://app.hyperliquid.xyz/leaderboard'));
console.log(chalk.white('2. Click on any trader to see their address'));
console.log(chalk.white('3. Copy addresses of top traders (look for 0x... format)'));
console.log(chalk.white('4. Add them using: node scripts/bulk-add-whales.js\n'));

console.log(chalk.yellow('📝 To add addresses manually:'));
console.log(chalk.white('   Open scripts/add-starter-whales.js'));
console.log(chalk.white('   Add addresses to the starterAddresses array\n'));

const readline = await import('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log(chalk.cyan('Do you want to:'));
  console.log(chalk.white('1. Add the test address (has ~$30k and trades)'));
  console.log(chalk.white('2. Enter your own Hyperliquid addresses'));
  console.log(chalk.white('3. Skip and add addresses later\n'));
  
  const choice = await question(chalk.yellow('Enter choice (1/2/3): '));
  
  let addressesToAdd = [];
  
  if (choice === '1') {
    addressesToAdd = starterAddresses;
  } else if (choice === '2') {
    console.log(chalk.cyan('\n📝 Enter Hyperliquid addresses (one per line, empty line to finish):\n'));
    
    while (true) {
      const addr = await question(chalk.gray('Address: '));
      if (!addr.trim()) break;
      
      if (addr.startsWith('0x') && addr.length === 42) {
        addressesToAdd.push(addr.toLowerCase());
        console.log(chalk.green('  ✓ Added'));
      } else {
        console.log(chalk.red('  ✗ Invalid address format (should be 0x... with 42 characters)'));
      }
    }
  } else {
    console.log(chalk.yellow('\n⏭️  Skipped. Add addresses later using:'));
    console.log(chalk.white('   node scripts/bulk-add-whales.js\n'));
    rl.close();
    return;
  }
  
  if (addressesToAdd.length === 0) {
    console.log(chalk.yellow('\n⚠️  No addresses to add.\n'));
    rl.close();
    return;
  }
  
  // Add addresses
  const dataDir = './data';
  const whalesFile = path.join(dataDir, 'whales.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  let whales = {};
  if (fs.existsSync(whalesFile)) {
    whales = JSON.parse(fs.readFileSync(whalesFile, 'utf-8'));
  }
  
  const now = Date.now();
  let newCount = 0;
  
  console.log(chalk.cyan('\n📊 Adding addresses...\n'));
  
  for (const address of addressesToAdd) {
    if (whales[address]) {
      console.log(chalk.gray(`  ⊘ ${address} (already exists)`));
    } else {
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
        source: 'manual',
        lastActive: null
      };
      console.log(chalk.green(`  ✓ ${address}`));
      newCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${newCount} addresses`));
  console.log(chalk.green(`✅ Total tracked: ${Object.keys(whales).length}\n`));
  
  console.log(chalk.cyan.bold('🚀 Start monitoring:\n'));
  console.log(chalk.white('   npm run dev\n'));
  
  rl.close();
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});

