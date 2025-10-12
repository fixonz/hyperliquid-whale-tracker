export class LiquidationAnalyzer {
  constructor() {
    this.maintenanceMarginRatio = 0.03; // 3% maintenance margin (approximate)
  }

  /**
   * Calculate liquidation price for a position
   * Formula varies based on long/short and leverage
   */
  calculateLiquidationPrice(position, currentPrice) {
    const { side, entryPrice, leverage, marginUsed, size } = position;
    
    // If liquidation price is already provided by API, use it
    if (position.liquidationPx && position.liquidationPx > 0) {
      return position.liquidationPx;
    }

    const leverageValue = leverage || 1;
    const isLong = side === 'LONG';

    // Simplified liquidation formula
    // For longs: liqPrice = entryPrice * (1 - (1/leverage - maintenanceMargin))
    // For shorts: liqPrice = entryPrice * (1 + (1/leverage - maintenanceMargin))
    
    const mmr = this.maintenanceMarginRatio;
    const liquidationPriceMultiplier = (1 / leverageValue) - mmr;

    let liquidationPrice;
    if (isLong) {
      liquidationPrice = entryPrice * (1 - liquidationPriceMultiplier);
    } else {
      liquidationPrice = entryPrice * (1 + liquidationPriceMultiplier);
    }

    return Math.max(liquidationPrice, 0);
  }

  /**
   * Calculate distance to liquidation in percentage
   */
  calculateLiquidationDistance(position, currentPrice) {
    const liqPrice = this.calculateLiquidationPrice(position, currentPrice);
    const distance = ((currentPrice - liqPrice) / currentPrice) * 100;
    
    return {
      liquidationPrice: liqPrice,
      distancePercent: Math.abs(distance),
      isAtRisk: Math.abs(distance) < 10, // Less than 10% away
      priceMove: position.side === 'LONG' ? 
        ((liqPrice - currentPrice) / currentPrice) * 100 : 
        ((currentPrice - liqPrice) / currentPrice) * 100
    };
  }

  /**
   * Analyze liquidation risk for multiple positions
   */
  analyzePositions(positions, currentPrices) {
    const analysis = [];

    for (const position of positions) {
      const currentPrice = currentPrices[position.asset] || position.entryPrice;
      const liqAnalysis = this.calculateLiquidationDistance(position, currentPrice);

      analysis.push({
        ...position,
        currentPrice,
        ...liqAnalysis,
        notionalValue: Math.abs(position.size * currentPrice),
        unrealizedPnlPercent: ((currentPrice - position.entryPrice) / position.entryPrice) * 100 * 
          (position.side === 'LONG' ? 1 : -1)
      });
    }

    return analysis.sort((a, b) => a.distancePercent - b.distancePercent);
  }

  /**
   * Group positions by price level for heatmap
   */
  groupByPriceLevel(positions, currentPrices, priceStepPercent = 1) {
    const heatmap = new Map();

    for (const position of positions) {
      const currentPrice = currentPrices[position.asset] || position.entryPrice;
      const liqPrice = this.calculateLiquidationPrice(position, currentPrice);
      
      // Round to nearest price step
      const priceLevel = Math.round(liqPrice / (currentPrice * priceStepPercent / 100)) * 
        (currentPrice * priceStepPercent / 100);

      if (!heatmap.has(priceLevel)) {
        heatmap.set(priceLevel, {
          priceLevel,
          totalNotional: 0,
          longNotional: 0,
          shortNotional: 0,
          positions: []
        });
      }

      const level = heatmap.get(priceLevel);
      const notional = Math.abs(position.size * currentPrice);
      level.totalNotional += notional;
      
      if (position.side === 'LONG') {
        level.longNotional += notional;
      } else {
        level.shortNotional += notional;
      }
      
      level.positions.push(position);
    }

    return Array.from(heatmap.values()).sort((a, b) => a.priceLevel - b.priceLevel);
  }

  /**
   * Calculate total liquidation risk by asset
   */
  calculateRiskByAsset(positions, currentPrices) {
    const riskByAsset = new Map();

    for (const position of positions) {
      const asset = position.asset;
      const currentPrice = currentPrices[asset] || position.entryPrice;
      const liqAnalysis = this.calculateLiquidationDistance(position, currentPrice);

      if (!riskByAsset.has(asset)) {
        riskByAsset.set(asset, {
          asset,
          currentPrice,
          totalLongNotional: 0,
          totalShortNotional: 0,
          atRiskLongNotional: 0,
          atRiskShortNotional: 0,
          positionsCount: 0,
          atRiskCount: 0
        });
      }

      const risk = riskByAsset.get(asset);
      const notional = Math.abs(position.size * currentPrice);
      
      risk.positionsCount++;
      if (position.side === 'LONG') {
        risk.totalLongNotional += notional;
        if (liqAnalysis.isAtRisk) {
          risk.atRiskLongNotional += notional;
          risk.atRiskCount++;
        }
      } else {
        risk.totalShortNotional += notional;
        if (liqAnalysis.isAtRisk) {
          risk.atRiskShortNotional += notional;
          risk.atRiskCount++;
        }
      }
    }

    return Array.from(riskByAsset.values());
  }

  /**
   * Predict liquidation cascade potential
   */
  predictCascade(positions, currentPrices, priceChangePercent) {
    const cascadeInfo = {
      priceChange: priceChangePercent,
      liquidatedPositions: [],
      totalLiquidatedNotional: 0,
      affectedAssets: new Map()
    };

    for (const position of positions) {
      const currentPrice = currentPrices[position.asset] || position.entryPrice;
      const newPrice = currentPrice * (1 + priceChangePercent / 100);
      const liqPrice = this.calculateLiquidationPrice(position, currentPrice);

      const wouldLiquidate = (position.side === 'LONG' && newPrice <= liqPrice) ||
                             (position.side === 'SHORT' && newPrice >= liqPrice);

      if (wouldLiquidate) {
        const notional = Math.abs(position.size * currentPrice);
        cascadeInfo.liquidatedPositions.push(position);
        cascadeInfo.totalLiquidatedNotional += notional;

        if (!cascadeInfo.affectedAssets.has(position.asset)) {
          cascadeInfo.affectedAssets.set(position.asset, {
            asset: position.asset,
            liquidatedNotional: 0,
            liquidatedCount: 0
          });
        }

        const assetInfo = cascadeInfo.affectedAssets.get(position.asset);
        assetInfo.liquidatedNotional += notional;
        assetInfo.liquidatedCount++;
      }
    }

    cascadeInfo.affectedAssets = Array.from(cascadeInfo.affectedAssets.values());
    return cascadeInfo;
  }
}

