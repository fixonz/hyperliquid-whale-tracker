#!/usr/bin/env node

/**
 * Quick threshold adjustment helper
 */

import chalk from 'chalk';

console.log(chalk.cyan.bold('\n🔧 Alert Threshold Tuning Guide\n'));

console.log(chalk.yellow('Current Settings (check your .env):\n'));
console.log(chalk.gray('POLL_INTERVAL_MS=5000           # Scan every 5 seconds'));
console.log(chalk.gray('MIN_POSITION_SIZE_USD=50000     # Track positions > $50k'));
console.log(chalk.gray('WHALE_THRESHOLD_USD=100000      # Alert on positions > $100k\n'));

console.log(chalk.green.bold('🎯 Recommended Settings to Reduce Alerts:\n'));

console.log(chalk.yellow('Option 1: Less Frequent (Quieter)'));
console.log(chalk.cyan('POLL_INTERVAL_MS=30000          # Scan every 30 seconds (less spam)'));
console.log(chalk.cyan('MIN_POSITION_SIZE_USD=100000    # Only track $100k+ positions'));
console.log(chalk.cyan('WHALE_THRESHOLD_USD=500000      # Only alert on $500k+ positions\n'));

console.log(chalk.yellow('Option 2: Whale-Only Mode (Very Quiet)'));
console.log(chalk.cyan('POLL_INTERVAL_MS=60000          # Scan every 60 seconds'));
console.log(chalk.cyan('MIN_POSITION_SIZE_USD=250000    # Only track $250k+ positions'));
console.log(chalk.cyan('WHALE_THRESHOLD_USD=1000000     # Only alert on $1M+ positions\n'));

console.log(chalk.yellow('Option 3: Balanced (Recommended)'));
console.log(chalk.cyan('POLL_INTERVAL_MS=15000          # Scan every 15 seconds'));
console.log(chalk.cyan('MIN_POSITION_SIZE_USD=150000    # Track $150k+ positions'));
console.log(chalk.cyan('WHALE_THRESHOLD_USD=300000      # Alert on $300k+ positions\n'));

console.log(chalk.magenta.bold('📝 To Apply:\n'));
console.log(chalk.gray('1. Edit your .env file'));
console.log(chalk.gray('2. Change the values above'));
console.log(chalk.gray('3. Restart the bot (Ctrl+C then npm run dev)\n'));

console.log(chalk.cyan.bold('💡 Pro Tips:\n'));
console.log(chalk.gray('• Higher MIN_POSITION_SIZE_USD = fewer positions tracked'));
console.log(chalk.gray('• Higher WHALE_THRESHOLD_USD = fewer alerts sent'));
console.log(chalk.gray('• Higher POLL_INTERVAL_MS = less frequent updates'));
console.log(chalk.gray('• Start conservative, you can always lower thresholds later\n'));

console.log(chalk.yellow.bold('⚠️  Alert Types You Can Disable:\n'));
console.log(chalk.gray('Edit src/monitor.js to comment out alerts you don\'t want:\n'));
console.log(chalk.gray('• Line ~180: Whale open alerts (result.isNew)'));
console.log(chalk.gray('• Line ~230: Liquidation risk alerts (pos.isAtRisk)'));
console.log(chalk.gray('• Line ~240: Cluster alerts (cluster.totalNotional)\n'));

