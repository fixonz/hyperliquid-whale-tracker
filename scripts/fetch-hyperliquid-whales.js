#!/usr/bin/env node

/**
 * Fetch actual Hyperliquid whale addresses from the network
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

async function fetchHyperliquidData(endpoint, payload) {
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: endpoint, ...payload })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(chalk.red(`Error fetching ${endpoint}:`), error.message);
    return null;
  }
}

async function fetchRecentTrades() {
  console.log(chalk.cyan('\n📊 Fetching recent large trades...'));
  
  const coins = ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE', 'XRP', 'AVAX', 'MATIC', 'OP', 'INJ'];
  const addresses = new Set();
  
  for (const coin of coins) {
    console.log(chalk.gray(`  Scanning ${coin}...`));
    
    const trades = await fetchHyperliquidData('recentTrades', { coin });
    
    if (trades && Array.isArray(trades)) {
      for (const trade of trades) {
        // Look for large trades (>$100k)
        const notional = parseFloat(trade.px) * parseFloat(trade.sz);
        if (notional > 100000) {
          addresses.add(trade.user);
        }
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(chalk.green(`  Found ${addresses.size} addresses from recent large trades`));
  return Array.from(addresses);
}

async function fetchLeaderboard() {
  console.log(chalk.cyan('\n🏆 Fetching leaderboard...'));
  
  // Try to fetch leaderboard data
  const leaderboard = await fetchHyperliquidData('leaderboard', { timeWindow: 'allTime' });
  
  if (leaderboard && Array.isArray(leaderboard)) {
    console.log(chalk.green(`  Found ${leaderboard.length} addresses from leaderboard`));
    return leaderboard
      .filter(entry => entry.accountValue && parseFloat(entry.accountValue) > 100000)
      .map(entry => entry.user);
  }
  
  console.log(chalk.yellow('  Leaderboard not available'));
  return [];
}

async function fetchOpenInterest() {
  console.log(chalk.cyan('\n💰 Fetching addresses with large open interest...'));
  
  const meta = await fetchHyperliquidData('meta', {});
  if (!meta || !meta.universe) {
    console.log(chalk.yellow('  Meta data not available'));
    return [];
  }
  
  const addresses = new Set();
  
  // Get top traders for each asset
  for (const asset of meta.universe.slice(0, 20)) {
    const fundingHistory = await fetchHyperliquidData('fundingHistory', { 
      coin: asset.name,
      startTime: Date.now() - 24 * 60 * 60 * 1000 // Last 24h
    });
    
    if (fundingHistory && Array.isArray(fundingHistory)) {
      fundingHistory.forEach(entry => {
        if (entry.user) addresses.add(entry.user);
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(chalk.green(`  Found ${addresses.size} addresses from open interest data`));
  return Array.from(addresses);
}

async function main() {
  console.log(chalk.cyan.bold('\n🐋 Fetching Real Hyperliquid Whale Addresses...\n'));
  
  const allAddresses = new Set();
  
  // Fetch from multiple sources
  const [trades, leaderboard, openInterest] = await Promise.all([
    fetchRecentTrades().catch(() => []),
    fetchLeaderboard().catch(() => []),
    fetchOpenInterest().catch(() => [])
  ]);
  
  // Combine all sources
  [...trades, ...leaderboard, ...openInterest].forEach(addr => {
    if (addr && addr.startsWith('0x')) {
      allAddresses.add(addr.toLowerCase());
    }
  });
  
  console.log(chalk.cyan.bold(`\n📊 Total unique addresses found: ${allAddresses.size}\n`));
  
  if (allAddresses.size === 0) {
    console.log(chalk.yellow('⚠️  No addresses found. The API might have changed or be rate-limited.'));
    console.log(chalk.yellow('⚠️  You can manually add addresses using:'));
    console.log(chalk.white('   node scripts/bulk-add-whales.js\n'));
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
  
  console.log(chalk.yellow('Adding addresses to whale tracker...\n'));
  
  for (const address of allAddresses) {
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
        source: 'hyperliquid-api',
        lastActive: null
      };
      console.log(chalk.green(`  ✓ ${address.slice(0, 10)}...${address.slice(-6)}`));
      newCount++;
    }
  }
  
  // Save
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${newCount} new Hyperliquid whale addresses`));
  if (skippedCount > 0) {
    console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
  }
  console.log(chalk.green(`✅ Total addresses tracked: ${Object.keys(whales).length}`));
  
  console.log(chalk.cyan.bold('\n🚀 Ready! Restart the bot to track these addresses:\n'));
  console.log(chalk.white('   taskkill /IM node.exe /F && npm run dev\n'));
}

main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});

