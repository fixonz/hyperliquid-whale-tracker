#!/usr/bin/env node

/**
 * Bulk add whale addresses from a text file or command line
 * Usage: 
 *   node scripts/bulk-add-whales.js 0xAddr1 0xAddr2 0xAddr3
 *   Or create addresses.txt with one address per line
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const addresses = process.argv.slice(2);
const addressFile = './addresses.txt';

console.log(chalk.cyan.bold('\n📝 Bulk Adding Whale Addresses...\n'));

let addressesToAdd = [];

// Check if addresses provided via command line
if (addresses.length > 0) {
  addressesToAdd = addresses;
  console.log(chalk.gray(`Found ${addresses.length} addresses from command line`));
}
// Otherwise check for addresses.txt file
else if (fs.existsSync(addressFile)) {
  const fileContent = fs.readFileSync(addressFile, 'utf-8');
  addressesToAdd = fileContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('0x'));
  console.log(chalk.gray(`Found ${addressesToAdd.length} addresses from addresses.txt`));
}
// No addresses found
else {
  console.log(chalk.yellow('No addresses provided!\n'));
  console.log(chalk.white('Usage Options:\n'));
  console.log(chalk.gray('1. Command line:'));
  console.log(chalk.cyan('   node scripts/bulk-add-whales.js 0xAddr1 0xAddr2 0xAddr3\n'));
  console.log(chalk.gray('2. Create addresses.txt file:'));
  console.log(chalk.cyan('   echo "0xYourAddress1" > addresses.txt'));
  console.log(chalk.cyan('   echo "0xYourAddress2" >> addresses.txt'));
  console.log(chalk.cyan('   node scripts/bulk-add-whales.js\n'));
  console.log(chalk.yellow('💡 Quick way: Go to https://app.hyperliquid.xyz/leaderboard'));
  console.log(chalk.yellow('   Copy top trader addresses and paste them here!\n'));
  process.exit(1);
}

// Validate addresses
const validAddresses = [];
for (const addr of addressesToAdd) {
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    validAddresses.push(addr);
  } else {
    console.log(chalk.red(`✗ Invalid address format: ${addr}`));
  }
}

if (validAddresses.length === 0) {
  console.log(chalk.red('\n❌ No valid addresses found\n'));
  process.exit(1);
}

// Load existing whales
const dataDir = './data';
const whalesFile = path.join(dataDir, 'whales.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let whales = {};
if (fs.existsSync(whalesFile)) {
  whales = JSON.parse(fs.readFileSync(whalesFile, 'utf-8'));
}

// Add addresses
const now = Date.now();
let newCount = 0;
let skippedCount = 0;

console.log(chalk.yellow('\nProcessing addresses...\n'));

for (const address of validAddresses) {
  if (whales[address]) {
    console.log(chalk.gray(`  ⊘ ${address.slice(0, 8)}...${address.slice(-6)} (already tracked)`));
    skippedCount++;
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
      lastUpdated: now
    };
    console.log(chalk.green(`  ✓ ${address.slice(0, 8)}...${address.slice(-6)} (added)`));
    newCount++;
  }
}

// Save
fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));

console.log(chalk.green.bold(`\n✅ Added ${newCount} new whale addresses`));
if (skippedCount > 0) {
  console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
}
console.log(chalk.green(`✅ Total addresses tracked: ${Object.keys(whales).length}\n`));

console.log(chalk.cyan('🚀 Ready to start! Run: npm run dev\n'));

