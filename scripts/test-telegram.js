#!/usr/bin/env node

/**
 * Test Telegram bot configuration
 * Usage: node scripts/test-telegram.js
 */

import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function testTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log(chalk.cyan.bold('\n📱 Testing Telegram Configuration...\n'));

  if (!token) {
    console.log(chalk.red('❌ TELEGRAM_BOT_TOKEN not found in .env'));
    console.log(chalk.yellow('Add: TELEGRAM_BOT_TOKEN=your-bot-token\n'));
    process.exit(1);
  }

  if (!chatId) {
    console.log(chalk.red('❌ TELEGRAM_CHAT_ID not found in .env'));
    console.log(chalk.yellow('Add: TELEGRAM_CHAT_ID=your-chat-id\n'));
    process.exit(1);
  }

  console.log(chalk.gray(`Bot Token: ${token.substring(0, 20)}...`));
  console.log(chalk.gray(`Chat ID: ${chatId}\n`));

  try {
    // Test 1: Get bot info
    console.log(chalk.yellow('Test 1: Checking bot credentials...'));
    const botInfo = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    
    if (botInfo.data.ok) {
      console.log(chalk.green('✓ Bot credentials valid!'));
      console.log(chalk.gray(`  Bot name: ${botInfo.data.result.first_name}`));
      console.log(chalk.gray(`  Username: @${botInfo.data.result.username}`));
    } else {
      console.log(chalk.red('✗ Invalid bot token'));
      process.exit(1);
    }

    // Test 2: Send test message
    console.log(chalk.yellow('\nTest 2: Sending test message...'));
    const testMessage = `
<b>🐋 Hyperliquid Liquidation Alert Bot - Test Message</b>

✅ Your Telegram alerts are configured correctly!

<b>Bot Configuration:</b>
• Bot Token: Set ✓
• Chat ID: ${chatId}
• Status: <b>Active</b>

The bot will now send alerts for:
🐋 Whale position opens/closes
⚠️ Liquidation risk warnings
💰 Large position detections
🔥 Liquidation cluster alerts

<i>Test completed at ${new Date().toISOString()}</i>
    `.trim();

    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'HTML'
      }
    );

    if (response.data.ok) {
      console.log(chalk.green('✓ Test message sent successfully!'));
      console.log(chalk.gray('  Check your Telegram group for the message'));
    } else {
      console.log(chalk.red('✗ Failed to send message'));
      console.log(chalk.yellow('  Make sure the bot is added to your group'));
      console.log(chalk.yellow('  And has permission to send messages'));
    }

    console.log(chalk.green.bold('\n✅ Telegram alerts are working! You\'re all set.\n'));

  } catch (error) {
    console.log(chalk.red.bold('\n❌ Telegram test failed:'), error.message);
    
    if (error.response?.data?.description) {
      console.log(chalk.yellow('\nError details:'), error.response.data.description);
    }

    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log(chalk.gray('  1. Verify bot token is correct'));
    console.log(chalk.gray('  2. Make sure bot is added to the group'));
    console.log(chalk.gray('  3. Give bot "Send Messages" permission'));
    console.log(chalk.gray('  4. For groups, chat ID should start with -'));
    console.log(chalk.gray('  5. Try making the bot an admin in the group\n'));
    
    process.exit(1);
  }
}

testTelegram();

