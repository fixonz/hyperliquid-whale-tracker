# Grouped Big Position Alerts - Example

## What's New

The system now groups big position alerts by token, showing all major positions for the same asset in a single, comprehensive alert.

## Example Alert Format

### Before (Individual Alerts)
```
🚨 MAJOR POSITION OPENED

💰 BTC LONG
💵 Size: $15,000,000
📊 Entry: $45,000.00
⚡ Leverage: 10.0x
👤 Wallet: 0x1234...abcd
📈 ROI: 45.2%
```

### After (Grouped Alerts)
```
🚨 MAJOR BTC POSITIONS

💰 Total Volume: $45,000,000
📊 Positions: 3 (2L/1S)

1. LONG $20,000,000
   👤 0x1234...abcd
   📊 Entry: $45,000
   ⚡ Leverage: 10.0x
   📈 PnL: +2.5%
   🟢 Liq Risk: 8.2%
   📈 ROI: 45.2%

2. LONG $15,000,000
   👤 0x5678...efgh
   📊 Entry: $44,800
   ⚡ Leverage: 8.5x
   📈 PnL: +1.8%
   🟡 Liq Risk: 6.1%
   📈 ROI: 32.1%

3. SHORT $10,000,000
   👤 0x9abc...ijkl
   📊 Entry: $45,200
   ⚡ Leverage: 12.0x
   📉 PnL: -1.2%
   🔴 Liq Risk: 4.3%
   📈 ROI: 28.7%
```

## Features

### PnL Information
- **📈 Green**: Positive PnL
- **📉 Red**: Negative PnL
- Shows current profit/loss percentage

### Liquidation Risk
- **🔴 Red**: High risk (< 5% to liquidation)
- **🟡 Yellow**: Medium risk (5-10% to liquidation)
- **🟢 Green**: Low risk (> 10% to liquidation)

### Position Details
- Sorted by size (largest first)
- Shows entry price, leverage, and wallet link
- Includes whale ROI when available
- Total volume and position count

## Alert Types

### BIG Positions (10M+)
- **Pinned**: Yes (important alerts stay visible)
- **Threshold**: $10,000,000+
- **Grouping**: By token

### HOT Positions (1M-10M)
- **Pinned**: No (regular alerts)
- **Threshold**: $1,000,000 - $10,000,000
- **Grouping**: By token

## Benefits

1. **Better Overview**: See all major positions for a token at once
2. **Reduced Spam**: One alert per token instead of multiple individual alerts
3. **More Context**: Compare positions side-by-side
4. **Risk Assessment**: Quick liquidation risk overview
5. **Performance Tracking**: See PnL for each position

## Backward Compatibility

- Single positions still use the legacy format
- Only groups when there are 2+ positions for the same token
- All existing functionality remains unchanged
