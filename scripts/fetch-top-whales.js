#!/usr/bin/env node

/**
 * Fetch top 100 whale addresses from multiple sources
 */

import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { HyperliquidAPI } from '../src/api/hyperliquid.js';

const sources = {
  // Hyperliquid API endpoints
  hyperliquid: {
    name: 'Hyperliquid API',
    url: 'https://api.hyperliquid.xyz/info',
    enabled: true
  },
  // Could add more sources
  dune: {
    name: 'Dune Analytics',
    enabled: false // Requires API key
  },
  etherscan: {
    name: 'Etherscan/Arbiscan',
    enabled: false // Requires API key
  }
};

async function fetchFromHyperliquid() {
  console.log(chalk.yellow('📊 Fetching from Hyperliquid API...'));
  
  const api = new HyperliquidAPI();
  const addresses = new Set();

  try {
    // Try different endpoints that might expose user addresses
    
    // Method 1: Try to get funding leaders
    try {
      const response = await api.client.post('/info', {
        type: 'fundingLeaders'
      });
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach(item => {
          if (item.user || item.address) {
            addresses.add(item.user || item.address);
          }
        });
        console.log(chalk.green(`  ✓ Found ${addresses.size} addresses from funding leaders`));
      }
    } catch (e) {
      console.log(chalk.gray('  - Funding leaders endpoint not available'));
    }

    // Method 2: Try leaderboard
    try {
      const response = await api.client.post('/info', {
        type: 'leaderboard',
        timeWindow: '1d'
      });
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach(item => {
          if (item.user || item.address || item.ethAddress) {
            addresses.add(item.user || item.address || item.ethAddress);
          }
        });
        console.log(chalk.green(`  ✓ Found ${addresses.size} total addresses`));
      }
    } catch (e) {
      console.log(chalk.gray('  - Leaderboard endpoint not available'));
    }

    // Method 3: Sample recent trades for active addresses
    try {
      const coins = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'AVAX', 'MATIC', 'DOGE', 'LINK', 'UNI'];
      console.log(chalk.yellow(`  Scanning recent trades on ${coins.length} coins...`));
      
      for (const coin of coins) {
        try {
          const trades = await api.getRecentTrades(coin);
          trades.forEach(trade => {
            if (trade.user) {
              addresses.add(trade.user);
            }
          });
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
        } catch (e) {
          // Skip if error
        }
      }
      console.log(chalk.green(`  ✓ Found ${addresses.size} total unique addresses`));
    } catch (e) {
      console.log(chalk.gray('  - Could not scan recent trades'));
    }

  } catch (error) {
    console.log(chalk.red('  ✗ Error fetching from Hyperliquid:', error.message));
  }

  return Array.from(addresses);
}

async function fetchFromPublicLists() {
  console.log(chalk.yellow('\n📋 Checking public whale lists...'));
  
  const addresses = [];
  
  // Try to fetch from a GitHub gist or public list
  try {
    // Example: You could maintain a GitHub gist with known whales
    // const response = await axios.get('https://gist.githubusercontent.com/...');
    // addresses.push(...response.data.split('\n').filter(a => a.startsWith('0x')));
    
    console.log(chalk.gray('  - No public lists configured yet'));
    console.log(chalk.gray('    Add your own list URLs in scripts/fetch-top-whales.js'));
  } catch (error) {
    console.log(chalk.gray('  - Could not fetch public lists'));
  }

  return addresses;
}

async function enrichWithOnChainData(addresses) {
  console.log(chalk.yellow(`\n🔍 Analyzing ${addresses.length} addresses...`));
  
  const api = new HyperliquidAPI();
  const enrichedWhales = [];
  
  // Sample first 50 for analysis (to avoid rate limits)
  const samplesToCheck = Math.min(addresses.length, 50);
  console.log(chalk.gray(`  Checking first ${samplesToCheck} addresses for activity...`));
  
  let checked = 0;
  for (const address of addresses.slice(0, samplesToCheck)) {
    try {
      const userState = await api.getUserState(address);
      
      if (userState && userState.marginSummary) {
        const accountValue = parseFloat(userState.marginSummary.accountValue || 0);
        const positionCount = userState.assetPositions?.length || 0;
        
        if (accountValue > 0 || positionCount > 0) {
          enrichedWhales.push({
            address,
            accountValue,
            positionCount,
            hasActivity: positionCount > 0
          });
          
          if (accountValue > 100000 || positionCount > 0) {
            console.log(chalk.green(`  ✓ ${address.slice(0, 10)}... | $${(accountValue / 1000).toFixed(0)}K | ${positionCount} positions`));
          }
        }
      }
      
      checked++;
      if (checked % 10 === 0) {
        console.log(chalk.gray(`  Checked ${checked}/${samplesToCheck}...`));
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      // Skip errors
    }
  }
  
  return enrichedWhales;
}

async function saveWhales(whales) {
  const dataDir = './data';
  const whalesFile = path.join(dataDir, 'whales.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Load existing
  let existingWhales = {};
  if (fs.existsSync(whalesFile)) {
    existingWhales = JSON.parse(fs.readFileSync(whalesFile, 'utf-8'));
  }
  
  const now = Date.now();
  let newCount = 0;
  
  for (const whale of whales) {
    if (!existingWhales[whale.address]) {
      existingWhales[whale.address] = {
        address: whale.address,
        firstSeen: now,
        totalTrades: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        marginUsed: whale.accountValue || 0,
        roi: 0,
        winRate: 0,
        largestPosition: 0,
        activePositions: whale.positionCount || 0,
        lastUpdated: now,
        source: 'auto-discovery',
        lastActive: whale.hasActivity ? now : null
      };
      newCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(existingWhales, null, 2));
  
  return { total: Object.keys(existingWhales).length, new: newCount };
}

async function main() {
  console.log(chalk.cyan.bold('\n🐋 WHALE DISCOVERY TOOL\n'));
  console.log(chalk.gray('Searching for top whale addresses across multiple sources...\n'));
  
  let allAddresses = [];
  
  // Fetch from Hyperliquid
  if (sources.hyperliquid.enabled) {
    const addresses = await fetchFromHyperliquid();
    allAddresses.push(...addresses);
  }
  
  // Fetch from public lists
  const publicAddresses = await fetchFromPublicLists();
  allAddresses.push(...publicAddresses);
  
  // Remove duplicates
  allAddresses = [...new Set(allAddresses)];
  
  console.log(chalk.green.bold(`\n✓ Found ${allAddresses.length} unique addresses`));
  
  if (allAddresses.length === 0) {
    console.log(chalk.yellow('\n⚠️  No addresses found automatically.'));
    console.log(chalk.cyan('\n💡 Alternative Methods:\n'));
    console.log(chalk.white('1. Visit https://app.hyperliquid.xyz/leaderboard'));
    console.log(chalk.gray('   Copy addresses manually\n'));
    console.log(chalk.white('2. Check Hyperliquid Discord'));
    console.log(chalk.gray('   Ask community for known whales\n'));
    console.log(chalk.white('3. Use Dune Analytics'));
    console.log(chalk.gray('   Search for Hyperliquid dashboards\n'));
    console.log(chalk.white('4. Monitor live trading'));
    console.log(chalk.gray('   Watch for large orders and note addresses\n'));
    return;
  }
  
  // Enrich with on-chain data
  const enrichedWhales = await enrichWithOnChainData(allAddresses);
  
  // Filter to active/valuable whales
  const qualifiedWhales = enrichedWhales
    .filter(w => w.accountValue >= 50000 || w.positionCount > 0)
    .sort((a, b) => b.accountValue - a.accountValue);
  
  console.log(chalk.green.bold(`\n✓ Found ${qualifiedWhales.length} qualified whales (>$50k or active positions)`));
  
  if (qualifiedWhales.length > 0) {
    // Save to file
    const result = await saveWhales(qualifiedWhales);
    
    console.log(chalk.green.bold(`\n✅ Added ${result.new} new whale addresses`));
    console.log(chalk.green(`✅ Total whales tracked: ${result.total}`));
    
    // Show top 10
    console.log(chalk.cyan.bold('\n🏆 TOP 10 BY ACCOUNT VALUE:\n'));
    qualifiedWhales.slice(0, 10).forEach((w, i) => {
      console.log(chalk.white(`${i + 1}. ${w.address.slice(0, 10)}...${w.address.slice(-6)}`));
      console.log(chalk.gray(`   Value: $${(w.accountValue / 1000).toFixed(0)}K | Positions: ${w.positionCount}`));
    });
    
    console.log(chalk.cyan.bold('\n🚀 Ready! Restart the bot to track these whales:\n'));
    console.log(chalk.yellow('   npm run dev\n'));
  }
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

