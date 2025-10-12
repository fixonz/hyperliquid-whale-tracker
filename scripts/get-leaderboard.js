#!/usr/bin/env node

/**
 * Fetch addresses from Hyperliquid leaderboard
 * Usage: node scripts/get-leaderboard.js
 */

import { HyperliquidAPI } from '../src/api/hyperliquid.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

async function getLeaderboard() {
  console.log(chalk.cyan.bold('\n📊 Fetching Hyperliquid Leaderboard...\n'));

  const api = new HyperliquidAPI();

  try {
    // Try to get leaderboard data
    const response = await api.client.post('/info', {
      type: 'leaderboard'
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(chalk.green(`✓ Found ${response.data.length} traders on leaderboard\n`));

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

      // Show top 20 and add them
      console.log(chalk.yellow('Top 20 Traders:\n'));
      
      for (let i = 0; i < Math.min(20, response.data.length); i++) {
        const trader = response.data[i];
        const address = trader.user || trader.address || trader.ethAddress;
        
        if (!address) continue;

        const pnl = parseFloat(trader.accountValue || trader.pnl || 0);
        const rank = i + 1;

        console.log(chalk.gray(`${rank}. ${address.slice(0, 8)}...${address.slice(-6)}`), 
                    chalk.green(`PnL: $${pnl.toLocaleString()}`));

        if (!whales[address]) {
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
            source: 'leaderboard'
          };
          newCount++;
        }
      }

      // Save
      fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
      
      console.log(chalk.green.bold(`\n✓ Added ${newCount} new whale addresses`));
      console.log(chalk.green(`✓ Total addresses tracked: ${Object.keys(whales).length}\n`));

    } else {
      console.log(chalk.yellow('⚠️ Leaderboard endpoint returned no data'));
      showAlternatives();
    }

  } catch (error) {
    console.log(chalk.yellow('⚠️ Could not fetch leaderboard:'), error.message);
    showAlternatives();
  }
}

function showAlternatives() {
  console.log(chalk.cyan.bold('\n📝 Alternative Methods to Get Whale Addresses:\n'));
  
  console.log(chalk.yellow('1. Hyperliquid Website:'));
  console.log(chalk.gray('   Visit: https://app.hyperliquid.xyz/leaderboard'));
  console.log(chalk.gray('   Copy addresses of top traders\n'));

  console.log(chalk.yellow('2. Twitter/X:'));
  console.log(chalk.gray('   Search: "Hyperliquid whale" or "Hyperliquid trader"'));
  console.log(chalk.gray('   Follow whale tracking accounts\n'));

  console.log(chalk.yellow('3. Discord:'));
  console.log(chalk.gray('   Join Hyperliquid Discord'));
  console.log(chalk.gray('   Ask in trading channels\n'));

  console.log(chalk.yellow('4. Block Explorer:'));
  console.log(chalk.gray('   Check Arbitrum One explorer'));
  console.log(chalk.gray('   Look for large USDC transfers to Hyperliquid\n'));

  console.log(chalk.yellow('5. Manual Entry:'));
  console.log(chalk.gray('   node scripts/add-whale.js 0xYourWhaleAddress\n'));

  console.log(chalk.cyan('💡 Tip: Start with 5-10 addresses and add more as you find them.\n'));
}

getLeaderboard();

