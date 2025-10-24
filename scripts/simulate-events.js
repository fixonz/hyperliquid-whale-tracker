#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan.bold('\n🧪 Simulating event flow (open → reduce → close/liquidate)\n'));

  try {
    const base = 'http://localhost:3000';

    console.log(chalk.yellow('Fetching big alerts…'));
    const big = await axios.get(`${base}/api/alerts/big?limit=5`).then(r => r.data);
    console.log(chalk.gray(`Big alerts: ${big.length}`));

    console.log(chalk.yellow('Fetching follow-ups…'));
    const followups = await axios.get(`${base}/api/followups?limit=10`).then(r => r.data);
    console.log(chalk.gray(`Follow-ups: ${followups.length}`));

    console.log(chalk.yellow('Fetching top traders…'));
    const top = await axios.get(`${base}/api/top-traders`).then(r => r.data);
    console.log(chalk.gray(`Top traders: ${top.length}`));

    console.log(chalk.green('\n✅ Simulation complete. Inspect results above.\n'));
  } catch (e) {
    console.error(chalk.red('Simulation failed:'), e.message);
  }
}

main();


