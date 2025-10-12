#!/usr/bin/env node

/**
 * Fetch whale addresses from Hyperliquid leaderboard
 * Source: https://app.hyperliquid.xyz/leaderboard
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

async function fetchLeaderboard() {
  console.log(chalk.cyan.bold('\n🏆 Fetching Hyperliquid Leaderboard...\n'));
  
  try {
    // Fetch all-time leaderboard
    console.log(chalk.gray('Fetching all-time leaderboard...'));
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'leaderboard',
        req: {
          timeWindow: 'allTime'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.log(chalk.yellow('Response:'), JSON.stringify(data, null, 2));
      throw new Error('Unexpected response format');
    }
    
    console.log(chalk.green(`✓ Found ${data.length} traders on leaderboard\n`));
    
    // Filter for whales (account value > $100k or high volume)
    const whales = data.filter(entry => {
      const accountValue = parseFloat(entry.accountValue || 0);
      const volume = parseFloat(entry.vlm || 0);
      return accountValue > 100000 || volume > 1000000;
    });
    
    console.log(chalk.cyan(`🐋 ${whales.length} whales found (>$100k account value or >$1M volume)\n`));
    
    // Display top 10
    console.log(chalk.yellow.bold('TOP 10 TRADERS:\n'));
    whales.slice(0, 10).forEach((trader, i) => {
      const pnl = parseFloat(trader.pnl || 0);
      const accountValue = parseFloat(trader.accountValue || 0);
      const roi = parseFloat(trader.roi || 0);
      
      console.log(chalk.white(`${i + 1}. ${trader.ethAddress || trader.user || 'Unknown'}`));
      console.log(chalk.gray(`   PnL: $${pnl.toLocaleString()} | Account: $${accountValue.toLocaleString()} | ROI: ${(roi * 100).toFixed(2)}%`));
    });
    
    return whales;
    
  } catch (error) {
    console.error(chalk.red('Error fetching leaderboard:'), error.message);
    return null;
  }
}

async function fetchDailyLeaderboard() {
  console.log(chalk.cyan('\n📊 Fetching daily leaderboard for active traders...\n'));
  
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'leaderboard',
        req: {
          timeWindow: 'day'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      console.log(chalk.green(`✓ Found ${data.length} active traders today\n`));
      return data;
    }
    
    return [];
    
  } catch (error) {
    console.log(chalk.yellow('Could not fetch daily leaderboard'));
    return [];
  }
}

async function main() {
  console.log(chalk.cyan.bold('🐋 Hyperliquid Whale Address Fetcher'));
  console.log(chalk.gray('Source: https://app.hyperliquid.xyz/leaderboard\n'));
  
  // Fetch leaderboards
  const [allTime, daily] = await Promise.all([
    fetchLeaderboard(),
    fetchDailyLeaderboard()
  ]);
  
  if (!allTime || allTime.length === 0) {
    console.log(chalk.red('\n❌ Could not fetch whale addresses from leaderboard'));
    console.log(chalk.yellow('\n💡 Manual alternative:'));
    console.log(chalk.white('1. Visit: https://app.hyperliquid.xyz/leaderboard'));
    console.log(chalk.white('2. Copy addresses manually'));
    console.log(chalk.white('3. Add using: node scripts/bulk-add-whales.js\n'));
    process.exit(1);
  }
  
  // Combine and deduplicate
  const allTraders = new Set();
  [...allTime, ...daily].forEach(trader => {
    const address = trader.ethAddress || trader.user;
    if (address && address.startsWith('0x')) {
      allTraders.add(address.toLowerCase());
    }
  });
  
  console.log(chalk.cyan.bold(`\n📊 Total unique addresses: ${allTraders.size}\n`));
  
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
  
  console.log(chalk.yellow('Adding addresses to tracker...\n'));
  
  for (const address of allTraders) {
    if (whales[address]) {
      console.log(chalk.gray(`  ⊘ ${address.slice(0, 10)}...${address.slice(-6)} (already tracked)`));
      skippedCount++;
    } else {
      // Find trader data to enrich
      const traderData = allTime.find(t => 
        (t.ethAddress || t.user || '').toLowerCase() === address
      );
      
      whales[address] = {
        address,
        firstSeen: now,
        totalTrades: 0,
        realizedPnL: traderData ? parseFloat(traderData.pnl || 0) : 0,
        unrealizedPnL: 0,
        totalPnL: traderData ? parseFloat(traderData.pnl || 0) : 0,
        marginUsed: 0,
        roi: traderData ? parseFloat(traderData.roi || 0) * 100 : 0,
        winRate: traderData ? parseFloat(traderData.winRate || 0) * 100 : 0,
        largestPosition: 0,
        activePositions: 0,
        lastUpdated: now,
        source: 'hyperliquid-leaderboard',
        accountValue: traderData ? parseFloat(traderData.accountValue || 0) : 0,
        lastActive: null
      };
      
      console.log(chalk.green(`  ✓ ${address.slice(0, 10)}...${address.slice(-6)}`));
      if (traderData) {
        console.log(chalk.gray(`    Account: $${(whales[address].accountValue).toLocaleString()} | PnL: $${whales[address].realizedPnL.toLocaleString()}`));
      }
      newCount++;
    }
  }
  
  // Save
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${newCount} new whale addresses from Hyperliquid leaderboard`));
  if (skippedCount > 0) {
    console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
  }
  console.log(chalk.green(`✅ Total addresses tracked: ${Object.keys(whales).length}`));
  
  console.log(chalk.cyan.bold('\n🚀 Restart the bot to start tracking:\n'));
  console.log(chalk.white('   taskkill /IM node.exe /F && npm run dev\n'));
}

main().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});

