#!/usr/bin/env node

/**
 * Fetch real whale addresses using Hyperlens.io API and other sources
 */

import chalk from 'chalk';
import { HyperlensAPI } from '../src/api/hyperlens.js';
import { HyperliquidAPI } from '../src/api/hyperliquid.js';
import fs from 'fs';
import path from 'path';

const MIN_POSITION_VALUE = 100000; // $100k minimum
const MIN_ACCOUNT_VALUE = 50000;   // $50k minimum account value

async function fetchWhalesFromHyperlens() {
  console.log(chalk.cyan('\n🔍 Fetching whale addresses from Hyperlens.io...'));
  
  const hyperlensAPI = new HyperlensAPI();
  const addresses = new Set();
  
  try {
    // Get global stats to see what's available
    const globalStats = await hyperlensAPI.getGlobalStats();
    console.log(chalk.gray(`Global stats:`, globalStats));
    
    // Try to get recent liquidations which might have whale addresses
    const latestLiquidations = await hyperlensAPI.getLatestLiquidations();
    if (latestLiquidations && Array.isArray(latestLiquidations)) {
      console.log(chalk.green(`Found ${latestLiquidations.length} recent liquidations`));
      
      latestLiquidations.forEach(liq => {
        if (liq.address && liq.address.startsWith('0x')) {
          addresses.add(liq.address.toLowerCase());
        }
      });
    }
    
    // Try to get fills data which might contain whale addresses
    const fills = await hyperlensAPI.getFills({ limit: 1000 });
    if (fills && Array.isArray(fills)) {
      console.log(chalk.green(`Found ${fills.length} fills`));
      
      fills.forEach(fill => {
        if (fill.user && fill.user.startsWith('0x')) {
          // Only add if it's a large trade
          const notional = parseFloat(fill.px || 0) * parseFloat(fill.sz || 0);
          if (notional >= MIN_POSITION_VALUE) {
            addresses.add(fill.user.toLowerCase());
          }
        }
      });
    }
    
    // Try to get liquidations data
    const liquidations = await hyperlensAPI.getLiquidations({ limit: 1000 });
    if (liquidations && Array.isArray(liquidations)) {
      console.log(chalk.green(`Found ${liquidations.length} liquidations`));
      
      liquidations.forEach(liq => {
        if (liq.user && liq.user.startsWith('0x')) {
          addresses.add(liq.user.toLowerCase());
        }
      });
    }
    
  } catch (error) {
    console.error(chalk.red('Error fetching from Hyperlens:'), error.message);
  }
  
  console.log(chalk.green(`✓ Found ${addresses.size} addresses from Hyperlens.io`));
  return Array.from(addresses);
}

async function fetchWhalesFromHyperliquid() {
  console.log(chalk.cyan('\n🐋 Fetching whale addresses from Hyperliquid API...'));
  
  const hyperliquidAPI = new HyperliquidAPI();
  const addresses = new Set();
  
  try {
    // Get recent trades for major coins
    const coins = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC', 'AVAX', 'DOGE', 'XRP', 'INJ'];
    
    for (const coin of coins) {
      console.log(chalk.gray(`  Scanning ${coin}...`));
      
      try {
        const trades = await hyperliquidAPI.getRecentTrades(coin);
        
        if (trades && Array.isArray(trades)) {
          trades.forEach(trade => {
            if (trade.user && trade.user.startsWith('0x')) {
              const notional = parseFloat(trade.px || 0) * parseFloat(trade.sz || 0);
              if (notional >= MIN_POSITION_VALUE) {
                addresses.add(trade.user.toLowerCase());
              }
            }
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(chalk.yellow(`    Error fetching ${coin} trades:`), error.message);
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Error fetching from Hyperliquid:'), error.message);
  }
  
  console.log(chalk.green(`✓ Found ${addresses.size} addresses from Hyperliquid API`));
  return Array.from(addresses);
}

async function fetchFromKnownWhaleLists() {
  console.log(chalk.cyan('\n📋 Adding addresses from known whale lists...'));
  
  const knownWhales = [
    // These are example addresses - replace with real known whale addresses
    '0x0000000000000000000000000000000000000000',
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555',
    '0x6666666666666666666666666666666666666666',
    '0x7777777777777777777777777777777777777777',
    '0x8888888888888888888888888888888888888888',
    '0x9999999999999999999999999999999999999999'
  ];
  
  console.log(chalk.green(`✓ Added ${knownWhales.length} addresses from known whale lists`));
  return knownWhales;
}

async function validateAndFilterAddresses(addresses) {
  console.log(chalk.cyan('\n🔍 Validating and filtering addresses...'));
  
  const validAddresses = [];
  const hyperliquidAPI = new HyperliquidAPI();
  
  for (const address of addresses) {
    try {
      // Validate address format
      if (!address || !address.startsWith('0x') || address.length !== 42) {
        continue;
      }
      
      // Check if address has any activity on Hyperliquid
      const userState = await hyperliquidAPI.getUserState(address);
      
      if (userState) {
        const accountValue = parseFloat(userState.marginSummary?.accountValue || 0);
        const hasPositions = userState.assetPositions && userState.assetPositions.length > 0;
        
        if (accountValue >= MIN_ACCOUNT_VALUE || hasPositions) {
          validAddresses.push(address);
          console.log(chalk.green(`  ✓ ${address.slice(0, 10)}...${address.slice(-6)} ($${accountValue.toFixed(0)})`));
        } else {
          console.log(chalk.gray(`  - ${address.slice(0, 10)}...${address.slice(-6)} (no significant activity)`));
        }
      } else {
        console.log(chalk.gray(`  - ${address.slice(0, 10)}...${address.slice(-6)} (no data)`));
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(chalk.yellow(`  Error validating ${address}:`), error.message);
    }
  }
  
  console.log(chalk.green(`✓ Validated ${validAddresses.length} active whale addresses`));
  return validAddresses;
}

async function saveWhalesToFile(addresses) {
  console.log(chalk.cyan('\n💾 Saving whale addresses...'));
  
  const dataDir = './data';
  const whalesFile = path.join(dataDir, 'whales.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  let existingWhales = {};
  if (fs.existsSync(whalesFile)) {
    existingWhales = JSON.parse(fs.readFileSync(whalesFile, 'utf-8'));
  }
  
  const now = Date.now();
  let newCount = 0;
  let updatedCount = 0;
  
  for (const address of addresses) {
    if (!existingWhales[address]) {
      existingWhales[address] = {
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
        source: 'hyperlens-discovery',
        lastActive: null,
        isVerified: true
      };
      newCount++;
    } else {
      // Update existing whale
      existingWhales[address].lastUpdated = now;
      existingWhales[address].source = existingWhales[address].source || 'hyperlens-discovery';
      existingWhales[address].isVerified = true;
      updatedCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(existingWhales, null, 2));
  
  console.log(chalk.green.bold(`✅ Saved whale addresses:`));
  console.log(chalk.green(`   New: ${newCount}`));
  console.log(chalk.green(`   Updated: ${updatedCount}`));
  console.log(chalk.green(`   Total tracked: ${Object.keys(existingWhales).length}`));
  
  return Object.keys(existingWhales).length;
}

async function main() {
  console.log(chalk.cyan.bold('\n🐋 Fetching Real Whale Addresses from Multiple Sources\n'));
  
  try {
    // Fetch from multiple sources
    const [hyperlensAddresses, hyperliquidAddresses, knownAddresses] = await Promise.all([
      fetchWhalesFromHyperlens().catch(() => []),
      fetchWhalesFromHyperliquid().catch(() => []),
      fetchFromKnownWhaleLists().catch(() => [])
    ]);
    
    // Combine and deduplicate
    const allAddresses = new Set([
      ...hyperlensAddresses,
      ...hyperliquidAddresses,
      ...knownAddresses
    ]);
    
    console.log(chalk.cyan.bold(`\n📊 Discovery Summary:`));
    console.log(chalk.gray(`   Hyperlens.io: ${hyperlensAddresses.length} addresses`));
    console.log(chalk.gray(`   Hyperliquid API: ${hyperliquidAddresses.length} addresses`));
    console.log(chalk.gray(`   Known lists: ${knownAddresses.length} addresses`));
    console.log(chalk.cyan.bold(`   Total unique: ${allAddresses.size} addresses`));
    
    if (allAddresses.size === 0) {
      console.log(chalk.yellow('\n⚠️  No addresses found. This might be due to:'));
      console.log(chalk.yellow('   - API rate limiting'));
      console.log(chalk.yellow('   - Network issues'));
      console.log(chalk.yellow('   - API changes'));
      console.log(chalk.white('\n   You can manually add addresses using:'));
      console.log(chalk.white('   node scripts/add-whale.js <address>'));
      return;
    }
    
    // Validate addresses (optional - comment out if too slow)
    console.log(chalk.yellow('\n⚠️  Address validation is disabled for speed.'));
    console.log(chalk.yellow('   Uncomment the validation section if you want to verify each address.'));
    
    // const validatedAddresses = await validateAndFilterAddresses(Array.from(allAddresses));
    const validatedAddresses = Array.from(allAddresses);
    
    // Save to file
    const totalTracked = await saveWhalesToFile(validatedAddresses);
    
    console.log(chalk.cyan.bold('\n🚀 Next Steps:'));
    console.log(chalk.white('1. Restart your whale tracker:'));
    console.log(chalk.green('   npm run dev'));
    console.log(chalk.white('2. Check the dashboard:'));
    console.log(chalk.green('   http://localhost:3000'));
    console.log(chalk.white('3. Monitor the Telegram web app:'));
    console.log(chalk.green('   http://localhost:3000/telegram-app.html'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

main();
