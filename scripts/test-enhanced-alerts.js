#!/usr/bin/env node

/**
 * Test script for enhanced alerts with Hyperlens.io integration
 */

import chalk from 'chalk';
import { EnhancedAlertManager } from '../src/alerts/enhancedAlertManager.js';

// Mock test data
const mockPosition = {
  asset: 'ETH',
  side: 'LONG',
  address: '0x1234567890123456789012345678901234567890',
  size: 10.5,
  entryPrice: 2500,
  liquidationPx: 2300,
  leverage: 5.0,
  unrealizedPnL: -25000,
  positionValue: 26250
};

const mockRiskData = {
  level: 'critical',
  distance: 3.2,
  riskScore: 85,
  historicalLiquidations: 2
};

const mockWhale = {
  address: '0x1234567890123456789012345678901234567890',
  roi: 45.6,
  totalPnL: 125000,
  marginUsed: 50000,
  activePositions: 3,
  totalTrades: 127,
  riskScore: 75
};

async function testEnhancedAlerts() {
  console.log(chalk.cyan.bold('\n🚨 Testing Enhanced Alerts with Hyperlens.io Integration\n'));

  const alertManager = new EnhancedAlertManager({
    enableConsole: true,
    // Disable actual sending for testing
    telegramToken: null,
    discordWebhook: null
  });

  try {
    // Test 1: Enhanced Liquidation Alert
    console.log(chalk.yellow('1. Testing Enhanced Liquidation Alert...'));
    await alertManager.sendEnhancedLiquidationAlert(mockPosition, []);

    // Test 2: Cascade Warning Alert
    console.log(chalk.yellow('\n2. Testing Cascade Warning Alert...'));
    await alertManager.sendCascadeWarningAlert(
      ['ETH', 'BTC', 'SOL', 'ARB'], 
      15000000 // $15M estimated impact
    );

    // Test 3: Whale Pattern Alert
    console.log(chalk.yellow('\n3. Testing Whale Pattern Alert...'));
    await alertManager.sendWhalePatternAlert(mockWhale, {
      type: 'dormant_wake',
      daysInactive: 7,
      positionValue: 50000
    });

    // Test 4: Volatility Alert
    console.log(chalk.yellow('\n4. Testing Volatility Alert...'));
    await alertManager.sendVolatilityAlert('ETH', {
      spikeLevel: 'high',
      priceChange: 8.5,
      duration: 15
    });

    // Test 5: Liquidation Cluster Alert
    console.log(chalk.yellow('\n5. Testing Liquidation Cluster Alert...'));
    await alertManager.sendClusterAlert({
      price: 2400,
      totalRisk: 2500000,
      positionCount: 15,
      riskLevel: 'high',
      cascadeRisk: 75
    });

    // Test 6: Enhanced Risk Alert
    console.log(chalk.yellow('\n6. Testing Enhanced Risk Alert...'));
    await alertManager.sendEnhancedRiskAlert(mockPosition, mockRiskData);

    // Test 7: Hyperlens Insight Alert
    console.log(chalk.yellow('\n7. Testing Hyperlens Insight Alert...'));
    await alertManager.sendHyperlensInsightAlert('whale_discovery', {
      positionValue: 75000,
      severity: 'high'
    });

    console.log(chalk.green.bold('\n✅ All enhanced alert tests completed successfully!\n'));

  } catch (error) {
    console.error(chalk.red('❌ Error testing alerts:'), error.message);
  }
}

async function testAlertSeverityLevels() {
  console.log(chalk.cyan.bold('\n📊 Testing Alert Severity Levels\n'));

  const alertManager = new EnhancedAlertManager({ enableConsole: true });

  const testPositions = [
    { ...mockPosition, size: 0.5, entryPrice: 2500 },   // Small: $1,250
    { ...mockPosition, size: 10, entryPrice: 2500 },    // Medium: $25,000  
    { ...mockPosition, size: 100, entryPrice: 2500 },   // Large: $250,000
    { ...mockPosition, size: 1000, entryPrice: 2500 }   // Massive: $2.5M
  ];

  for (const position of testPositions) {
    const severity = alertManager.getLiquidationSeverity(Math.abs(position.size * position.entryPrice));
    console.log(chalk.gray(`Position: $${(position.size * position.entryPrice).toLocaleString()} → Severity: ${severity}`));
  }
}

async function main() {
  try {
    await testEnhancedAlerts();
    await testAlertSeverityLevels();
    
    console.log(chalk.cyan.bold('\n🎉 Enhanced Alert System Ready!\n'));
    console.log(chalk.white('New alert types available:'));
    console.log(chalk.green('  • Enhanced Liquidation Alerts (with Hyperlens data)'));
    console.log(chalk.green('  • Cascade Warning Alerts'));
    console.log(chalk.green('  • Whale Pattern Detection Alerts'));
    console.log(chalk.green('  • Volatility Spike Alerts'));
    console.log(chalk.green('  • Liquidation Cluster Alerts'));
    console.log(chalk.green('  • Enhanced Risk Alerts'));
    console.log(chalk.green('  • Hyperlens Insight Alerts'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test suite failed:'), error);
    process.exit(1);
  }
}

main();
