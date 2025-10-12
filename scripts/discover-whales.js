#!/usr/bin/env node

/**
 * Script to discover whale addresses from recent large trades
 * Usage: node scripts/discover-whales.js
 */

import dotenv from 'dotenv';
import { HyperliquidAPI } from '../src/api/hyperliquid.js';
import { AddressDiscovery } from '../src/utils/addressDiscovery.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const MIN_TRADE_SIZE = parseFloat(process.env.MIN_POSITION_SIZE_USD) || 50000;
const COINS = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC', 'AVAX', 'DOGE'];

async function discoverWhales() {
  console.log('🔍 Starting whale discovery...\n');
  console.log(`Min trade size: $${MIN_TRADE_SIZE.toLocaleString()}`);
  console.log(`Scanning coins: ${COINS.join(', ')}\n`);

  const api = new HyperliquidAPI(process.env.HYPERLIQUID_API_URL);
  const discovery = new AddressDiscovery(api);

  try {
    const addresses = await discovery.discoverFromTrades(COINS, MIN_TRADE_SIZE);
    
    console.log(`\n✓ Found ${addresses.length} addresses with large trades\n`);

    if (addresses.length === 0) {
      console.log('No whale addresses discovered. Try:');
      console.log('1. Lowering MIN_POSITION_SIZE_USD in .env');
      console.log('2. Adding more coins to scan');
      console.log('3. Manually adding known whale addresses');
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

    // Add new addresses
    let newCount = 0;
    const now = Date.now();

    for (const address of addresses) {
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
          lastUpdated: now
        };
        newCount++;
        console.log(`  + ${address}`);
      }
    }

    // Save
    fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
    
    console.log(`\n✓ Added ${newCount} new whale addresses`);
    console.log(`✓ Total addresses being tracked: ${Object.keys(whales).length}`);
    console.log('\nRestart the monitor to begin tracking these addresses.');

  } catch (error) {
    console.error('Error discovering whales:', error);
    process.exit(1);
  }
}

discoverWhales();

