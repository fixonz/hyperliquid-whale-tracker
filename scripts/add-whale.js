#!/usr/bin/env node

/**
 * Helper script to add whale addresses to the monitoring system
 * Usage: node scripts/add-whale.js 0xWhaleAddress
 */

import fs from 'fs';
import path from 'path';

const address = process.argv[2];

if (!address) {
  console.error('Usage: node scripts/add-whale.js <address>');
  process.exit(1);
}

// Validate address format (basic check)
if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error('Invalid address format. Expected: 0x followed by 40 hex characters');
  process.exit(1);
}

const dataDir = './data';
const whalesFile = path.join(dataDir, 'whales.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing whales
let whales = {};
if (fs.existsSync(whalesFile)) {
  try {
    whales = JSON.parse(fs.readFileSync(whalesFile, 'utf-8'));
  } catch (error) {
    console.error('Error reading whales file:', error.message);
  }
}

// Check if already exists
if (whales[address]) {
  console.log(`Address ${address} is already being tracked.`);
  console.log('Current data:', JSON.stringify(whales[address], null, 2));
  process.exit(0);
}

// Add new whale
whales[address] = {
  address,
  firstSeen: Date.now(),
  totalTrades: 0,
  realizedPnL: 0,
  unrealizedPnL: 0,
  totalPnL: 0,
  marginUsed: 0,
  roi: 0,
  winRate: 0,
  largestPosition: 0,
  activePositions: 0,
  lastUpdated: Date.now()
};

// Save
try {
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));
  console.log(`✓ Successfully added whale address: ${address}`);
  console.log('Restart the monitor to begin tracking this address.');
} catch (error) {
  console.error('Error saving whale data:', error.message);
  process.exit(1);
}

