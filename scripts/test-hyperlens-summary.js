import { HyperlensAPI } from '../src/api/hyperlens.js';

async function testHyperlensSummaryData() {
  const api = new HyperlensAPI();
  
  console.log('🧪 Testing Hyperlens.io API for summary page data...\n');
  
  try {
    // Test with a known whale address (you can replace this with any address)
    const testAddress = '0x4a1b3580f7ac72bc54175f05b76092eeb7a266aa';
    
    console.log(`📍 Testing with address: ${testAddress}\n`);
    
    // 1. Test Address Stats
    console.log('📊 Testing getAddressStats...');
    const addressStats = await api.getAddressStats(testAddress, {
      days: 7
    });
    
    console.log('Address Stats Response:');
    console.log(JSON.stringify(addressStats, null, 2));
    console.log('\n');
    
    // 2. Test Address Stats Summary
    console.log('📈 Testing getAddressStatsSummary...');
    const addressStatsSummary = await api.getAddressStatsSummary(testAddress);
    
    console.log('Address Stats Summary Response:');
    console.log(JSON.stringify(addressStatsSummary, null, 2));
    console.log('\n');
    
    // 3. Test Fills for this address
    console.log('💹 Testing getFills for address...');
    const fills = await api.getFills({
      address: testAddress,
      limit: 10
    });
    
    console.log('Fills Response:');
    console.log(JSON.stringify(fills, null, 2));
    console.log('\n');
    
    // 4. Test Liquidations for this address
    console.log('💥 Testing getLiquidations for address...');
    const liquidations = await api.getLiquidations({
      address: testAddress,
      limit: 10
    });
    
    console.log('Liquidations Response:');
    console.log(JSON.stringify(liquidations, null, 2));
    console.log('\n');
    
    // 5. Test Portfolio Data
    console.log('💼 Testing getPortfolioData...');
    const portfolio = await api.getPortfolioData(testAddress);
    
    console.log('Portfolio Response:');
    console.log(JSON.stringify(portfolio, null, 2));
    console.log('\n');
    
    // 6. Test Positions Data
    console.log('📋 Testing getPositionsData...');
    const positions = await api.getPositionsData(testAddress);
    
    console.log('Positions Response:');
    console.log(JSON.stringify(positions, null, 2));
    console.log('\n');
    
    // 7. Test Best/Worst Trades
    console.log('🎯 Testing getBestWorstTrades...');
    const bestWorst = await api.getBestWorstTrades(testAddress);
    
    console.log('Best/Worst Trades Response:');
    console.log(JSON.stringify(bestWorst, null, 2));
    console.log('\n');
    
    // 8. Test Performance by Coin (need to specify a coin)
    console.log('🪙 Testing getAddressPerformanceByCoin...');
    const performance = await api.getAddressPerformanceByCoin(testAddress, 'ETH');
    
    console.log('Performance by Coin Response:');
    console.log(JSON.stringify(performance, null, 2));
    console.log('\n');
    
    console.log('✅ All API tests completed!');
    
    // Summary of what we found
    console.log('\n📋 SUMMARY FOR SUMMARY PAGE:');
    console.log('===========================');
    
    if (addressStats && addressStats.length > 0) {
      const latestStats = addressStats[0];
      console.log('📊 Daily Stats Available:');
      console.log(`  - Trades: ${latestStats.trades}`);
      console.log(`  - Total Volume: $${latestStats.total_volume}`);
      console.log(`  - Total PnL: $${latestStats.total_pnl}`);
      console.log(`  - Win Rate: ${latestStats.winning_trades}/${latestStats.trades} (${((latestStats.winning_trades/latestStats.trades)*100).toFixed(1)}%)`);
      console.log(`  - Liquidated Trades: ${latestStats.liquidated_trades}`);
    }
    
    if (portfolio) {
      console.log('💼 Portfolio Data Available:');
      console.log(`  - Total Value: $${portfolio.totalValue || 'N/A'}`);
      console.log(`  - Positions: ${portfolio.positions?.length || 0}`);
    }
    
    if (fills && fills.length > 0) {
      console.log('💹 Recent Fills Available:');
      console.log(`  - Recent Fills: ${fills.length}`);
      console.log(`  - Latest Asset: ${fills[0].coin}`);
      console.log(`  - Latest Side: ${fills[0].side}`);
      console.log(`  - Latest Size: ${fills[0].size}`);
    }
    
    if (liquidations && liquidations.length > 0) {
      console.log('💥 Liquidations Available:');
      console.log(`  - Total Liquidations: ${liquidations.length}`);
      console.log(`  - Latest Liquidation: ${liquidations[0].coin} ${liquidations[0].side}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing Hyperlens.io API:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testHyperlensSummaryData();
