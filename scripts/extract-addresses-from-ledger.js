#!/usr/bin/env node

/**
 * Extract whale addresses from Hyperliquid ledger updates
 * This endpoint returns 2000+ transactions with user addresses!
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const API_URL = 'https://api.hyperliquid.xyz/info';

async function fetchLedgerUpdates(address) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'userNonFundingLedgerUpdates',
        user: address
      })
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    return [];
  }
}

async function extractAddressesFromLedger() {
  console.log(chalk.cyan.bold('\n🔍 Extracting Addresses from Hyperliquid Ledger\n'));
  
  const addresses = new Set();
  
  // Start with a known address to get ledger data
  const startAddress = '0x0000000000000000000000000000000000000000';
  
  console.log(chalk.yellow('Fetching ledger updates...'));
  const ledger = await fetchLedgerUpdates(startAddress);
  
  console.log(chalk.green(`✓ Got ${ledger.length} ledger entries`));
  
  // Extract user addresses from ledger
  for (const entry of ledger) {
    if (entry.delta) {
      // Extract from delta object
      if (entry.delta.user) {
        addresses.add(entry.delta.user.toLowerCase());
      }
      
      // Also check nested fields
      if (entry.delta.from) addresses.add(entry.delta.from.toLowerCase());
      if (entry.delta.to) addresses.add(entry.delta.to.toLowerCase());
      if (entry.delta.address) addresses.add(entry.delta.address.toLowerCase());
    }
    
    if (entry.user) {
      addresses.add(entry.user.toLowerCase());
    }
  }
  
  console.log(chalk.green(`✓ Extracted ${addresses.size} unique addresses\n`));
  
  // Filter valid addresses
  const validAddresses = Array.from(addresses).filter(addr => {
    return addr.startsWith('0x') && 
           addr.length === 42 &&
           addr !== '0x0000000000000000000000000000000000000000' &&
           !addr.match(/^0x[0]+$/);
  });
  
  console.log(chalk.cyan(`Valid addresses: ${validAddresses.length}\n`));
  
  return validAddresses;
}

async function verifyAndRankAddresses(addresses) {
  console.log(chalk.yellow('📊 Verifying and ranking addresses...\n'));
  console.log(chalk.gray(`Checking ${Math.min(addresses.length, 100)} addresses for activity...\n`));
  
  const whalesWithData = [];
  
  // Check first 100 addresses
  for (let i = 0; i < Math.min(addresses.length, 100); i++) {
    const address = addresses[i];
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: address
        })
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.marginSummary) {
        const accountValue = parseFloat(data.marginSummary.accountValue || 0);
        const positionCount = data.assetPositions?.length || 0;
        
        // Only track if they have significant account value or positions
        if (accountValue > 10000 || positionCount > 0) {
          whalesWithData.push({
            address,
            accountValue,
            positionCount
          });
          
          console.log(chalk.green(`  ✓ ${address.slice(0, 10)}... | $${(accountValue / 1000).toFixed(0)}K | ${positionCount} positions`));
        }
      }
      
      // Rate limiting
      if ((i + 1) % 10 === 0) {
        console.log(chalk.gray(`  Checked ${i + 1}/${Math.min(addresses.length, 100)}...`));
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      // Skip errors
    }
  }
  
  return whalesWithData.sort((a, b) => b.accountValue - a.accountValue);
}

async function main() {
  console.log(chalk.cyan.bold('🐋 Hyperliquid Address Discovery via Ledger\n'));
  
  // Extract addresses
  const addresses = await extractAddressesFromLedger();
  
  if (addresses.length === 0) {
    console.log(chalk.red('❌ No addresses found\n'));
    return;
  }
  
  // Verify and rank
  const qualifiedWhales = await verifyAndRankAddresses(addresses);
  
  console.log(chalk.green.bold(`\n✅ Found ${qualifiedWhales.length} qualified whales (>$10k or active positions)\n`));
  
  if (qualifiedWhales.length === 0) {
    console.log(chalk.yellow('No qualified whales found.\n'));
    return;
  }
  
  // Save to file
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
  
  for (const whale of qualifiedWhales) {
    if (!whales[whale.address]) {
      whales[whale.address] = {
        address: whale.address,
        firstSeen: now,
        totalTrades: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        marginUsed: whale.accountValue,
        roi: 0,
        winRate: 0,
        largestPosition: 0,
        activePositions: whale.positionCount,
        lastUpdated: now,
        source: 'ledger-discovery',
        lastActive: whale.positionCount > 0 ? now : null
      };
      newCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`✅ Added ${newCount} new whale addresses`));
  console.log(chalk.green(`✅ Total tracked: ${Object.keys(whales).length}\n`));
  
  // Show top 10
  console.log(chalk.yellow.bold('🏆 TOP 10 BY ACCOUNT VALUE:\n'));
  qualifiedWhales.slice(0, 10).forEach((w, i) => {
    console.log(chalk.white(`${i + 1}. ${w.address.slice(0, 10)}...${w.address.slice(-6)}`));
    console.log(chalk.gray(`   $${(w.accountValue / 1000).toFixed(0)}K | ${w.positionCount} positions`));
  });
  
  console.log(chalk.cyan.bold('\n🚀 Start monitoring:\n'));
  console.log(chalk.white('   npm run dev\n'));
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});

