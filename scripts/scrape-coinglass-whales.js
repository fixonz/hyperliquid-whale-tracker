#!/usr/bin/env node

/**
 * Scrape Hyperliquid whale addresses from CoinGlass
 * Source: https://www.coinglass.com/hl/range/8
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';

const COINGLASS_URL = 'https://www.coinglass.com/hl/range/8';

// Try different range categories to get more addresses
const RANGES = [
  { id: 8, name: 'Leviathan ($0 - ∞)' },
  { id: 7, name: 'Whale ($10M - ∞)' },
  { id: 6, name: 'Shark ($1M - $10M)' },
  { id: 5, name: 'Dolphin ($100K - $1M)' }
];

async function fetchCoinGlassData(rangeId) {
  const url = `https://www.coinglass.com/hl/range/${rangeId}`;
  console.log(chalk.gray(`  Fetching: ${url}`));
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    return html;
  } catch (error) {
    console.error(chalk.red(`  Error fetching range ${rangeId}:`), error.message);
    return null;
  }
}

async function scrapeAddressesFromHTML(html) {
  const addresses = new Set();
  
  try {
    // Look for Ethereum addresses (0x followed by 40 hex characters)
    const addressRegex = /0x[a-fA-F0-9]{40}/g;
    const matches = html.match(addressRegex);
    
    if (matches) {
      matches.forEach(addr => addresses.add(addr.toLowerCase()));
    }
    
    // Also try to parse if there's JSON data embedded
    const jsonMatches = html.match(/\{[^}]*"address"[^}]*\}/g);
    if (jsonMatches) {
      jsonMatches.forEach(match => {
        try {
          const obj = JSON.parse(match);
          if (obj.address && obj.address.startsWith('0x')) {
            addresses.add(obj.address.toLowerCase());
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
    }
    
  } catch (error) {
    console.error(chalk.red('Error parsing HTML:'), error.message);
  }
  
  return Array.from(addresses);
}

async function tryAPIEndpoint(rangeId) {
  // CoinGlass might have an API endpoint
  const apiUrls = [
    `https://www.coinglass.com/api/hl/range/${rangeId}`,
    `https://api.coinglass.com/api/hl/range/${rangeId}`,
    `https://www.coinglass.com/api/futures/hl/range/${rangeId}`
  ];
  
  for (const url of apiUrls) {
    try {
      console.log(chalk.gray(`  Trying API: ${url}`));
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log(chalk.green(`  ✓ API response: ${JSON.stringify(data).slice(0, 100)}`));
        return data;
      }
    } catch (error) {
      // Try next URL
    }
  }
  
  return null;
}

async function main() {
  console.log(chalk.cyan.bold('\n🐋 Scraping Hyperliquid Whale Addresses from CoinGlass\n'));
  console.log(chalk.gray('Source: https://www.coinglass.com/hl/range/\n'));
  
  const allAddresses = new Set();
  
  for (const range of RANGES) {
    console.log(chalk.cyan(`\n📊 Fetching ${range.name}...`));
    
    // Try API first
    const apiData = await tryAPIEndpoint(range.id);
    if (apiData) {
      // Parse API data for addresses
      const apiJson = JSON.stringify(apiData);
      const addressMatches = apiJson.match(/0x[a-fA-F0-9]{40}/g);
      if (addressMatches) {
        addressMatches.forEach(addr => allAddresses.add(addr.toLowerCase()));
      }
    }
    
    // Also try HTML scraping
    const html = await fetchCoinGlassData(range.id);
    if (html) {
      const addresses = await scrapeAddressesFromHTML(html);
      console.log(chalk.green(`  Found ${addresses.length} addresses from HTML`));
      addresses.forEach(addr => allAddresses.add(addr));
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(chalk.cyan.bold(`\n📊 Total unique addresses found: ${allAddresses.size}\n`));
  
  if (allAddresses.size === 0) {
    console.log(chalk.yellow('⚠️  No addresses found via scraping.'));
    console.log(chalk.yellow('⚠️  CoinGlass might require authentication or use dynamic loading.\n'));
    console.log(chalk.white('Alternative: Visit https://www.coinglass.com/hl/range/8 manually'));
    console.log(chalk.white('Copy addresses and use: node scripts/bulk-add-whales.js\n'));
    return;
  }
  
  // Filter out common/invalid addresses
  const validAddresses = Array.from(allAddresses).filter(addr => {
    // Remove all-zero address and other common test addresses
    return addr !== '0x0000000000000000000000000000000000000000' &&
           addr !== '0x0000000000000000000000000000000000000001' &&
           !addr.match(/^0x[0]+$/) &&
           !addr.match(/^0x[1]+$/) &&
           !addr.match(/^0x[f]+$/);
  });
  
  console.log(chalk.cyan(`Valid addresses: ${validAddresses.length}\n`));
  
  if (validAddresses.length === 0) {
    console.log(chalk.yellow('⚠️  No valid addresses found after filtering.\n'));
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
  let skippedCount = 0;
  
  console.log(chalk.yellow('Adding addresses...\n'));
  
  for (const address of validAddresses) {
    if (whales[address]) {
      console.log(chalk.gray(`  ⊘ ${address.slice(0, 10)}...${address.slice(-6)} (exists)`));
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
        source: 'coinglass',
        lastActive: null
      };
      console.log(chalk.green(`  ✓ ${address.slice(0, 10)}...${address.slice(-6)}`));
      newCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${newCount} new addresses from CoinGlass`));
  if (skippedCount > 0) {
    console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
  }
  console.log(chalk.green(`✅ Total tracked: ${Object.keys(whales).length}\n`));
  
  console.log(chalk.cyan.bold('🚀 Start monitoring:\n'));
  console.log(chalk.white('   npm run dev\n'));
}

main().catch(error => {
  console.error(chalk.red('\n❌ Error:'), error);
  process.exit(1);
});

