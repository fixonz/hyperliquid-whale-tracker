import { LiquidationMonitor } from './monitor.js';

/**
 * Main entry point - starts both monitor and server
 */
async function main() {
  console.log('Starting Hyperliquid Liquidation Alert System...\n');
  
  // Import and start the server (which also starts the monitor)
  await import('./server.js');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

