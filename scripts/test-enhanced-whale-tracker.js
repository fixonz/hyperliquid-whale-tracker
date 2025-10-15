#!/usr/bin/env node

/**
 * Test script for Enhanced Whale Tracker with Hyperlens.io integration
 */

import chalk from 'chalk';
import { EnhancedWhaleTracker } from '../src/trackers/enhancedWhaleTracker.js';

// Test whale addresses (replace with real addresses)
const TEST_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222'
];

async function testEnhancedWhaleTracker() {
  console.log(chalk.cyan.bold('\n🐋 Testing Enhanced Whale Tracker with Hyperlens.io Integration\n'));
  
  const tracker = new EnhancedWhaleTracker();
  
  try {
    // Test 1: Update individual whale
    console.log(chalk.yellow('1. Testing individual whale update...'));
    const whale = await tracker.updateWhaleEnhanced(TEST_ADDRESSES[0]);
    
    if (whale) {
      console.log(chalk.green('✅ Whale updated successfully'));
      console.log(chalk.gray(`Address: ${whale.address}`));
      console.log(chalk.gray(`Total PnL: $${whale.totalPnL?.toFixed(2) || 'N/A'}`));
      console.log(chalk.gray(`ROI: ${whale.roi?.toFixed(2) || 'N/A'}%`));
      console.log(chalk.gray(`Risk Score: ${whale.riskScore?.toFixed(2) || 'N/A'}`));
      console.log(chalk.gray(`Active Positions: ${whale.activePositions}`));
      console.log(chalk.gray(`Win Rate: ${whale.winRate?.toFixed(2) || 'N/A'}%`));
      console.log(chalk.gray(`Has Hyperlens Data: ${whale.hyperlensStats ? 'Yes' : 'No'}`));
    } else {
      console.log(chalk.red('❌ Failed to update whale'));
    }

    // Test 2: Batch update
    console.log(chalk.yellow('\n2. Testing batch whale update...'));
    const batchResults = await tracker.updateBatchWhales(TEST_ADDRESSES.slice(0, 2));
    
    console.log(chalk.green(`✅ Batch update completed: ${batchResults.length} whales processed`));
    batchResults.forEach(result => {
      const status = result.success ? chalk.green('✅') : chalk.red('❌');
      console.log(`${status} ${result.address}: ${result.success ? 'Success' : result.error}`);
    });

    // Test 3: Get enhanced analytics
    console.log(chalk.yellow('\n3. Testing enhanced analytics...'));
    const analytics = tracker.getEnhancedAnalytics();
    
    console.log(chalk.green('✅ Analytics generated:'));
    console.log(chalk.gray(`Total Whales: ${analytics.totalWhales}`));
    console.log(chalk.gray(`Active Whales: ${analytics.activeWhales}`));
    console.log(chalk.gray(`Dormant Whales: ${analytics.dormantWhales}`));
    console.log(chalk.gray(`Profitable Whales: ${analytics.profitableWhales}`));
    console.log(chalk.gray(`Total Notional Value: $${analytics.totalNotionalValue?.toFixed(2) || 'N/A'}`));
    console.log(chalk.gray(`Average ROI: ${analytics.averageROI?.toFixed(2) || 'N/A'}%`));
    console.log(chalk.gray(`Average Risk Score: ${analytics.averageRiskScore?.toFixed(2) || 'N/A'}`));
    console.log(chalk.gray(`Total Liquidations: ${analytics.totalLiquidations}`));

    // Test 4: Get top whales with different sorting
    console.log(chalk.yellow('\n4. Testing top whales with different sorting...'));
    
    const topByPnL = tracker.getTopWhalesEnhanced(5, 'totalPnL');
    console.log(chalk.green('✅ Top whales by PnL:'));
    topByPnL.forEach((whale, index) => {
      console.log(chalk.gray(`${index + 1}. ${whale.address?.slice(0, 8)}... - PnL: $${whale.totalPnL?.toFixed(2) || 'N/A'} - ROI: ${whale.roi?.toFixed(2) || 'N/A'}%`));
    });

    const topByROI = tracker.getTopWhalesEnhanced(5, 'roi');
    console.log(chalk.green('\n✅ Top whales by ROI:'));
    topByROI.forEach((whale, index) => {
      console.log(chalk.gray(`${index + 1}. ${whale.address?.slice(0, 8)}... - ROI: ${whale.roi?.toFixed(2) || 'N/A'}% - PnL: $${whale.totalPnL?.toFixed(2) || 'N/A'}`));
    });

    const topByRisk = tracker.getTopWhalesEnhanced(5, 'riskScore');
    console.log(chalk.green('\n✅ Top whales by Risk Score:'));
    topByRisk.forEach((whale, index) => {
      console.log(chalk.gray(`${index + 1}. ${whale.address?.slice(0, 8)}... - Risk: ${whale.riskScore?.toFixed(2) || 'N/A'} - PnL: $${whale.totalPnL?.toFixed(2) || 'N/A'}`));
    });

    // Test 5: Test liquidation history
    console.log(chalk.yellow('\n5. Testing liquidation history...'));
    const liquidationHistory = tracker.getLiquidationHistory(TEST_ADDRESSES[0]);
    console.log(chalk.green(`✅ Liquidation history for ${TEST_ADDRESSES[0]?.slice(0, 8)}...: ${liquidationHistory.length} events`));
    
    if (liquidationHistory.length > 0) {
      liquidationHistory.slice(0, 3).forEach((liquidation, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${liquidation.coin || 'Unknown'} - $${liquidation.value || 'N/A'} - ${liquidation.timestamp || 'N/A'}`));
      });
    }

    // Test 6: Test dormant whales
    console.log(chalk.yellow('\n6. Testing dormant whale detection...'));
    const dormantWhales = tracker.getDormantWhales();
    const wokenWhales = tracker.getWokenWhales();
    
    console.log(chalk.green(`✅ Dormant whales: ${dormantWhales.length}`));
    console.log(chalk.green(`✅ Woken whales: ${wokenWhales.length}`));

    // Test 7: Test cleanup
    console.log(chalk.yellow('\n7. Testing cleanup...'));
    tracker.cleanupStaleData();
    console.log(chalk.green('✅ Cleanup completed'));

    console.log(chalk.cyan.bold('\n🎉 All Enhanced Whale Tracker tests completed successfully!\n'));

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(chalk.gray(error.stack));
  }
}

// Performance test
async function testPerformance() {
  console.log(chalk.cyan.bold('\n⚡ Performance Test\n'));
  
  const tracker = new EnhancedWhaleTracker();
  const testAddresses = Array(10).fill().map((_, i) => `0x${i.toString().padStart(40, '0')}`);
  
  console.log(chalk.yellow('Testing batch update performance with 10 addresses...'));
  
  const startTime = Date.now();
  const results = await tracker.updateBatchWhales(testAddresses);
  const duration = Date.now() - startTime;
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(chalk.green(`✅ Performance test completed in ${duration}ms`));
  console.log(chalk.gray(`Successful: ${successful}/${results.length}`));
  console.log(chalk.gray(`Failed: ${failed}/${results.length}`));
  console.log(chalk.gray(`Average time per whale: ${(duration / results.length).toFixed(2)}ms`));
}

// Run tests
async function main() {
  try {
    await testEnhancedWhaleTracker();
    await testPerformance();
  } catch (error) {
    console.error(chalk.red('❌ Test suite failed:'), error);
    process.exit(1);
  }
}

main();
