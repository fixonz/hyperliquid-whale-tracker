export class HeatmapGenerator {
  constructor(priceStepPercent = 0.5) {
    this.priceStepPercent = priceStepPercent; // 0.5% steps by default
  }

  /**
   * Generate a comprehensive liquidation heatmap
   */
  generateHeatmap(positions, currentPrices) {
    const heatmapData = {
      timestamp: Date.now(),
      assets: new Map(),
      globalLevels: new Map()
    };

    // Group by asset first
    const positionsByAsset = new Map();
    for (const position of positions) {
      const asset = position.asset;
      if (!positionsByAsset.has(asset)) {
        positionsByAsset.set(asset, []);
      }
      positionsByAsset.get(asset).push(position);
    }

    // Generate heatmap for each asset
    for (const [asset, assetPositions] of positionsByAsset.entries()) {
      const currentPrice = currentPrices[asset];
      if (!currentPrice) continue;

      const assetHeatmap = this.generateAssetHeatmap(
        asset,
        assetPositions,
        currentPrice
      );

      heatmapData.assets.set(asset, assetHeatmap);

      // Aggregate into global levels
      for (const level of assetHeatmap.levels) {
        const percentFromCurrent = ((level.priceLevel - currentPrice) / currentPrice) * 100;
        const globalKey = Math.round(percentFromCurrent / this.priceStepPercent);

        if (!heatmapData.globalLevels.has(globalKey)) {
          heatmapData.globalLevels.set(globalKey, {
            percentFromCurrent: globalKey * this.priceStepPercent,
            totalNotional: 0,
            longNotional: 0,
            shortNotional: 0,
            positionCount: 0,
            assets: new Map()
          });
        }

        const globalLevel = heatmapData.globalLevels.get(globalKey);
        globalLevel.totalNotional += level.totalNotional;
        globalLevel.longNotional += level.longNotional;
        globalLevel.shortNotional += level.shortNotional;
        globalLevel.positionCount += level.positionCount;

        if (!globalLevel.assets.has(asset)) {
          globalLevel.assets.set(asset, {
            asset,
            notional: 0,
            longNotional: 0,
            shortNotional: 0
          });
        }

        const assetData = globalLevel.assets.get(asset);
        assetData.notional += level.totalNotional;
        assetData.longNotional += level.longNotional;
        assetData.shortNotional += level.shortNotional;
      }
    }

    // Convert to arrays and sort
    heatmapData.assets = Array.from(heatmapData.assets.entries()).map(([asset, data]) => ({
      asset,
      ...data
    }));

    heatmapData.globalLevels = Array.from(heatmapData.globalLevels.values())
      .sort((a, b) => a.percentFromCurrent - b.percentFromCurrent)
      .map(level => ({
        ...level,
        assets: Array.from(level.assets.values())
      }));

    return heatmapData;
  }

  /**
   * Generate heatmap for a single asset
   */
  generateAssetHeatmap(asset, positions, currentPrice) {
    const levels = new Map();
    const priceRange = {
      min: currentPrice * 0.5, // 50% below
      max: currentPrice * 1.5  // 50% above
    };

    // Calculate liquidation points and bucket them
    for (const position of positions) {
      const liqPrice = position.liquidationPx || 
        this.estimateLiquidationPrice(position, currentPrice);

      // Only include liquidations within our price range
      if (liqPrice < priceRange.min || liqPrice > priceRange.max) {
        continue;
      }

      // Calculate which level this belongs to
      const percentFromCurrent = ((liqPrice - currentPrice) / currentPrice) * 100;
      const levelKey = Math.round(percentFromCurrent / this.priceStepPercent);
      const levelPrice = currentPrice * (1 + (levelKey * this.priceStepPercent / 100));

      if (!levels.has(levelKey)) {
        levels.set(levelKey, {
          priceLevel: levelPrice,
          percentFromCurrent: levelKey * this.priceStepPercent,
          totalNotional: 0,
          longNotional: 0,
          shortNotional: 0,
          positionCount: 0,
          positions: []
        });
      }

      const level = levels.get(levelKey);
      const notional = Math.abs(position.size * currentPrice);

      level.totalNotional += notional;
      if (position.side === 'LONG') {
        level.longNotional += notional;
      } else {
        level.shortNotional += notional;
      }
      level.positionCount++;
      level.positions.push({
        address: position.address,
        size: position.size,
        side: position.side,
        notional
      });
    }

    const sortedLevels = Array.from(levels.values())
      .sort((a, b) => a.priceLevel - b.priceLevel);

    // Find the most significant liquidation clusters
    const clusters = this.identifyLiquidationClusters(sortedLevels);

    return {
      asset,
      currentPrice,
      levels: sortedLevels,
      clusters,
      summary: {
        totalLongNotional: sortedLevels.reduce((sum, l) => sum + l.longNotional, 0),
        totalShortNotional: sortedLevels.reduce((sum, l) => sum + l.shortNotional, 0),
        totalPositions: positions.length,
        priceRange
      }
    };
  }

  /**
   * Identify significant liquidation clusters
   */
  identifyLiquidationClusters(levels, threshold = 0.1) {
    if (levels.length === 0) return [];

    const maxNotional = Math.max(...levels.map(l => l.totalNotional));
    const clusters = [];
    let currentCluster = null;

    for (const level of levels) {
      const significance = level.totalNotional / maxNotional;

      if (significance >= threshold) {
        if (!currentCluster) {
          currentCluster = {
            startPrice: level.priceLevel,
            endPrice: level.priceLevel,
            startPercent: level.percentFromCurrent,
            endPercent: level.percentFromCurrent,
            totalNotional: 0,
            longNotional: 0,
            shortNotional: 0,
            positionCount: 0,
            levels: []
          };
        }

        currentCluster.endPrice = level.priceLevel;
        currentCluster.endPercent = level.percentFromCurrent;
        currentCluster.totalNotional += level.totalNotional;
        currentCluster.longNotional += level.longNotional;
        currentCluster.shortNotional += level.shortNotional;
        currentCluster.positionCount += level.positionCount;
        currentCluster.levels.push(level);
      } else if (currentCluster) {
        clusters.push(currentCluster);
        currentCluster = null;
      }
    }

    if (currentCluster) {
      clusters.push(currentCluster);
    }

    return clusters.sort((a, b) => b.totalNotional - a.totalNotional);
  }

  /**
   * Estimate liquidation price if not provided
   */
  estimateLiquidationPrice(position, currentPrice) {
    const mmr = 0.03; // 3% maintenance margin
    const leverage = position.leverage || 1;
    const isLong = position.side === 'LONG';
    
    const liquidationPriceMultiplier = (1 / leverage) - mmr;

    if (isLong) {
      return position.entryPrice * (1 - liquidationPriceMultiplier);
    } else {
      return position.entryPrice * (1 + liquidationPriceMultiplier);
    }
  }

  /**
   * Generate simplified heatmap for visualization
   */
  generateSimplifiedHeatmap(positions, currentPrices, steps = 20) {
    const heatmap = [];
    
    for (const [asset, currentPrice] of Object.entries(currentPrices)) {
      const assetPositions = positions.filter(p => p.asset === asset);
      if (assetPositions.length === 0) continue;

      const priceRange = currentPrice * 0.3; // +/- 30%
      const stepSize = (priceRange * 2) / steps;

      for (let i = 0; i < steps; i++) {
        const priceLevel = currentPrice - priceRange + (stepSize * i);
        const percentFromCurrent = ((priceLevel - currentPrice) / currentPrice) * 100;

        let longNotional = 0;
        let shortNotional = 0;

        for (const position of assetPositions) {
          const liqPrice = position.liquidationPx || 
            this.estimateLiquidationPrice(position, currentPrice);
          
          // Check if this position would liquidate at this price level
          const wouldLiquidate = 
            (position.side === 'LONG' && priceLevel <= liqPrice) ||
            (position.side === 'SHORT' && priceLevel >= liqPrice);

          if (Math.abs(liqPrice - priceLevel) < stepSize && wouldLiquidate) {
            const notional = Math.abs(position.size * currentPrice);
            if (position.side === 'LONG') {
              longNotional += notional;
            } else {
              shortNotional += notional;
            }
          }
        }

        if (longNotional > 0 || shortNotional > 0) {
          heatmap.push({
            asset,
            priceLevel,
            percentFromCurrent,
            longNotional,
            shortNotional,
            totalNotional: longNotional + shortNotional
          });
        }
      }
    }

    return heatmap.sort((a, b) => b.totalNotional - a.totalNotional);
  }
}

