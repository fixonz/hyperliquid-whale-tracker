#!/usr/bin/env node

/**
 * Add ALL addresses from Hyperliquid ledger (no filtering)
 * The threshold will filter them during scanning anyway
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const API_URL = 'https://api.hyperliquid.xyz/info';

async function fetchLedgerAddresses() {
  console.log(chalk.cyan.bold('\n🔍 Extracting ALL Addresses from Hyperliquid Ledger\n'));
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'userNonFundingLedgerUpdates',
        user: '0x0000000000000000000000000000000000000000'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const ledger = await response.json();
    console.log(chalk.green(`✓ Fetched ${ledger.length} ledger entries`));
    
    // Extract all addresses
    const addresses = new Set();
    for (const entry of ledger) {
      if (entry.delta?.user) addresses.add(entry.delta.user.toLowerCase());
      if (entry.user) addresses.add(entry.user.toLowerCase());
      if (entry.delta?.from) addresses.add(entry.delta.from.toLowerCase());
      if (entry.delta?.to) addresses.add(entry.delta.to.toLowerCase());
    }
    
    console.log(chalk.green(`✓ Extracted ${addresses.size} unique addresses\n`));
    
    // Filter only valid format
    const validAddresses = Array.from(addresses).filter(addr => 
      addr.startsWith('0x') && 
      addr.length === 42 &&
      addr !== '0x0000000000000000000000000000000000000000'
    );
    
    console.log(chalk.cyan(`Valid addresses: ${validAddresses.length}\n`));
    
    return validAddresses;
    
  } catch (error) {
    console.error(chalk.red('Error fetching ledger:'), error.message);
    return [];
  }
}

async function main() {
  // Fetch all addresses
  const addresses = await fetchLedgerAddresses();
  
  if (addresses.length === 0) {
    console.log(chalk.red('❌ No addresses found\n'));
    return;
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
  
  const now = Date.now();
  let newCount = 0;
  let skippedCount = 0;
  
  console.log(chalk.yellow('Adding ALL addresses...\n'));
  
  for (const address of addresses) {
    if (whales[address]) {
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
        lastUpdated: now,
        source: 'ledger-all',
        lastActive: null
      };
      console.log(chalk.green(`  ✓ ${address.slice(0, 10)}...${address.slice(-6)}`));
      newCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${newCount} new addresses`));
  if (skippedCount > 0) {
    console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
  }
  console.log(chalk.green.bold(`✅ Total tracked: ${Object.keys(whales).length}`));
  
  console.log(chalk.cyan('\n💡 The bot will only alert on positions meeting your thresholds:'));
  console.log(chalk.gray(`   MIN_POSITION_SIZE_USD = $1,000,000`));
  console.log(chalk.gray(`   WHALE_THRESHOLD_USD = $1,000,000`));
  
  console.log(chalk.cyan.bold('\n🚀 Start monitoring:\n'));
  console.log(chalk.white('   npm run dev\n'));
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});

