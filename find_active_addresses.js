import axios from 'axios';

async function findActiveAddresses() {
  console.log('🔍 Finding active addresses from recent trades...\n');
  
  try {
    // Get recent trades for major assets
    const assets = ['BTC', 'ETH', 'SOL', 'ARB'];
    const activeAddresses = new Set();
    
    for (const asset of assets) {
      console.log(`Checking recent ${asset} trades...`);
      
      const response = await axios.post('https://api.hyperliquid.xyz/info', {
        type: 'recentTrades',
        coin: asset
      });
      
      // Extract unique addresses from trades
      for (const trade of response.data) {
        for (const user of trade.users) {
          if (user !== '0x0000000000000000000000000000000000000000') {
            activeAddresses.add(user);
          }
        }
      }
      
      console.log(`  Found ${response.data.length} ${asset} trades`);
    }
    
    console.log(`\n📊 Total unique active addresses: ${activeAddresses.size}`);
    
    // Test a few active addresses for fills
    const addressesToTest = Array.from(activeAddresses).slice(0, 5);
    
    for (const address of addressesToTest) {
      try {
        console.log(`\n🔍 Testing ${address.slice(0, 10)}...`);
        
        // Check user fills
        const fillsResponse = await axios.post('https://api.hyperliquid.xyz/info', {
          type: 'userFills',
          user: address
        });
        
        console.log(`  Fills: ${fillsResponse.data.length}`);
        
        if (fillsResponse.data.length > 0) {
          // Check for recent liquidations
          const recentFills = fillsResponse.data.filter(fill => {
            const fillTime = fill.time || fill.timestamp || 0;
            return Date.now() - fillTime < 24 * 60 * 60 * 1000; // Last 24h
          });
          
          console.log(`  Recent fills (24h): ${recentFills.length}`);
          
          // Look for liquidation indicators
          const liquidations = recentFills.filter(fill => {
            return fill.isLiquidation || 
                   fill.liquidation || 
                   (fill.closedPnl && fill.closedPnl < 0 && Math.abs(fill.sz) < 0.001);
          });
          
          if (liquidations.length > 0) {
            console.log(`🚨 LIQUIDATIONS FOUND: ${liquidations.length}`);
            console.log('Sample liquidation:', JSON.stringify(liquidations[0], null, 2));
          }
          
          // Show fill structure
          if (fillsResponse.data.length > 0) {
            console.log('Fill structure:', Object.keys(fillsResponse.data[0]));
            console.log('Sample fill:', JSON.stringify(fillsResponse.data[0], null, 2));
          }
        }
        
        // Check user state
        const stateResponse = await axios.post('https://api.hyperliquid.xyz/info', {
          type: 'clearinghouseState',
          user: address
        });
        
        if (stateResponse.data && stateResponse.data.marginSummary) {
          const accountValue = parseFloat(stateResponse.data.marginSummary.accountValue || 0);
          const positions = stateResponse.data.assetPositions || [];
          console.log(`  Account value: $${accountValue}, Positions: ${positions.length}`);
        }
        
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findActiveAddresses();
