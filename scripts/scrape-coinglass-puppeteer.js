#!/usr/bin/env node

/**
 * Scrape Hyperliquid whale addresses from CoinGlass using Puppeteer
 * Source: https://www.coinglass.com/hl/range/8
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import puppeteer from 'puppeteer';

const RANGES = [
  { id: 8, name: 'Leviathan' },
  { id: 7, name: 'Whale' },
  { id: 6, name: 'Shark' }
];

async function scrapeAddressesWithPuppeteer(rangeId) {
  const url = `https://www.coinglass.com/hl/range/${rangeId}`;
  console.log(chalk.cyan(`\n📊 Scraping: ${url}`));
  
  let browser;
  try {
    console.log(chalk.gray('  Launching browser...'));
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log(chalk.gray('  Loading page...'));
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for table to load
    console.log(chalk.gray('  Waiting for data to load...'));
    await page.waitForTimeout(5000); // Give time for JS to load data
    
    // Extract addresses from the page
    const addresses = await page.evaluate(() => {
      const addrs = new Set();
      
      // Try to find addresses in table
      const cells = document.querySelectorAll('td, div, span');
      const addressRegex = /0x[a-fA-F0-9]{40}/;
      
      cells.forEach(cell => {
        const text = cell.textContent || cell.innerText || '';
        const match = text.match(addressRegex);
        if (match) {
          addrs.add(match[0]);
        }
      });
      
      // Also check for data attributes
      const elements = document.querySelectorAll('[data-address], [data-wallet]');
      elements.forEach(el => {
        const addr = el.getAttribute('data-address') || el.getAttribute('data-wallet');
        if (addr && addr.startsWith('0x')) {
          addrs.add(addr);
        }
      });
      
      return Array.from(addrs);
    });
    
    console.log(chalk.green(`  ✓ Found ${addresses.length} addresses`));
    
    await browser.close();
    return addresses;
    
  } catch (error) {
    console.error(chalk.red(`  Error: ${error.message}`));
    if (browser) await browser.close();
    return [];
  }
}

async function main() {
  console.log(chalk.cyan.bold('\n🐋 Scraping Hyperliquid Whale Addresses (Puppeteer)\n'));
  console.log(chalk.gray('Source: https://www.coinglass.com/hl/range/\n'));
  console.log(chalk.yellow('⏱️  This may take a few minutes as we render JavaScript pages...\n'));
  
  const allAddresses = new Set();
  
  for (const range of RANGES) {
    const addresses = await scrapeAddressesWithPuppeteer(range.id);
    addresses.forEach(addr => allAddresses.add(addr.toLowerCase()));
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(chalk.cyan.bold(`\n📊 Total unique addresses found: ${allAddresses.size}\n`));
  
  if (allAddresses.size === 0) {
    console.log(chalk.red('❌ No addresses found.'));
    console.log(chalk.yellow('\nThe website structure might have changed or requires login.'));
    console.log(chalk.yellow('Please visit https://www.coinglass.com/hl/range/8 manually'));
    console.log(chalk.yellow('and use: node scripts/bulk-add-whales.js\n'));
    return;
  }
  
  // Filter valid addresses
  const validAddresses = Array.from(allAddresses).filter(addr => {
    return addr !== '0x0000000000000000000000000000000000000000' &&
           !addr.match(/^0x[0]+$/) &&
           !addr.match(/^0x[1]+$/) &&
           !addr.match(/^0x[f]+$/);
  });
  
  console.log(chalk.cyan(`Valid addresses after filtering: ${validAddresses.length}\n`));
  
  if (validAddresses.length === 0) {
    console.log(chalk.yellow('No valid addresses after filtering.\n'));
    return;
  }
  
  // Display addresses
  console.log(chalk.yellow.bold('Found Addresses:\n'));
  validAddresses.slice(0, 10).forEach((addr, i) => {
    console.log(chalk.white(`${i + 1}. ${addr}`));
  });
  if (validAddresses.length > 10) {
    console.log(chalk.gray(`... and ${validAddresses.length - 10} more`));
  }
  
  // Save
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
  
  console.log(chalk.cyan('\n📝 Adding to whale tracker...\n'));
  
  for (const address of validAddresses) {
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
        source: 'coinglass-puppeteer',
        lastActive: null
      };
      console.log(chalk.green(`  ✓ ${address.slice(0, 10)}...${address.slice(-6)}`));
      newCount++;
    }
  }
  
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  
  console.log(chalk.green.bold(`\n✅ Added ${newCount} new whale addresses`));
  if (skippedCount > 0) {
    console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
  }
  console.log(chalk.green(`✅ Total tracked: ${Object.keys(whales).length}\n`));
  
  console.log(chalk.cyan.bold('🚀 Start monitoring:\n'));
  console.log(chalk.white('   npm run dev\n'));
}

main().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});

