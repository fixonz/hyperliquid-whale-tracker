import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LiquidationMonitor } from './monitor.js';
import telegramWebhook from './telegramWebhook.js';
import { AlertsRepo } from './db/repositories/alerts.js';
import { getDb } from './db/client.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Initialize monitor
const monitor = new LiquidationMonitor();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Telegram webhook
app.use('/', telegramWebhook);

// API Routes

/**
 * Get current heatmap data
 */
app.get('/api/heatmap', (req, res) => {
  const heatmap = monitor.getHeatmap();
  res.json(heatmap || { assets: [], globalLevels: [] });
});

/**
 * Get monitoring stats
 */
app.get('/api/stats', (req, res) => {
  res.json(monitor.getStats());
});

/**
 * Get 7-minute digest stats
 */
app.get('/api/digest-stats', (req, res) => {
  res.json(monitor.digestManager.getCurrentStats());
});

/**
 * Get tracked positions
 */
app.get('/api/positions', (req, res) => {
  const positions = monitor.whaleTracker.getAllPositions();
  res.json(positions);
});

/**
 * Get positions by side
 */
app.get('/api/positions/:side', (req, res) => {
  const side = req.params.side.toUpperCase();
  const positions = monitor.whaleTracker.getPositionsBySide(side);
  res.json(positions);
});

/**
 * Get top whales
 */
app.get('/api/whales', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    // Use HyperlensWhaleTracker for real whale data
    const whales = await monitor.hyperlensWhaleTracker.getTopWhales(count);
    res.json(whales);
  } catch (error) {
    console.error('Error fetching whales:', error);
    // Fallback to old whale tracker if Hyperlens fails
    const whales = monitor.whaleTracker.getTopWhales(parseInt(req.query.count) || 20);
    res.json(whales);
  }
});

/**
 * Get whale data by address
 */
app.get('/api/whales/:address', async (req, res) => {
  try {
    // Try HyperlensWhaleTracker first
    const whale = await monitor.hyperlensWhaleTracker.getWhale(req.params.address);
    if (whale) {
      return res.json(whale);
    }
    
    // Fallback to old whale tracker
    const fallbackWhale = monitor.whaleTracker.getWhale(req.params.address);
    if (!fallbackWhale) {
      return res.status(404).json({ error: 'Whale not found' });
    }
    res.json(fallbackWhale);
  } catch (error) {
    console.error('Error fetching whale:', error);
    res.status(500).json({ error: 'Failed to fetch whale data' });
  }
});

/**
 * Get alert history
 */
app.get('/api/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const alerts = monitor.alertManager.getAlertHistory(limit);
  res.json(alerts);
});

/**
 * Get recent BIG alerts for WebApp
 */
app.get('/api/alerts/big', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const rows = AlertsRepo.recentBig(limit);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get top traders list (addresses only)
 */
app.get('/api/top-traders', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT address, rank, pnl, roi, account_value, last_refreshed FROM top_traders ORDER BY COALESCE(rank, 999999)').all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Follow-up alerts feed (e.g., position closes, liquidations, reductions)
 */
app.get('/api/followups', (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since) : null;
    const limit = parseInt(req.query.limit) || 50;
    const rows = AlertsRepo.recentByTypes(['TOP_TRADER_REDUCTION', 'LIQUIDATION', 'WHALE_CLOSE'], { since, limit });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DB-backed liquidation metrics endpoint
 */
app.get('/api/metrics/liquidations', (req, res) => {
  try {
    const window = (req.query.window || '7m').toString();
    const now = Date.now();
    const match = window.match(/^(\d+)([smhd])$/);
    let ms = 7 * 60 * 1000;
    if (match) {
      const val = parseInt(match[1]);
      const unit = match[2];
      const mult = unit === 's' ? 1000 : unit === 'm' ? 60 * 1000 : unit === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      ms = val * mult;
    }
    const since = now - ms;
    const total = AlertsRepo.sumLiquidationsSince(since);
    res.json({ window, since, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Add address to monitor
 */
app.post('/api/addresses', (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  monitor.addAddress(address);
  res.json({ success: true, address });
});

/**
 * Serve summary page
 */
app.get('/summary/:address', (req, res) => {
  const address = req.params.address;
  if (!address || address.length !== 42 || !address.startsWith('0x')) {
    return res.status(400).send('Invalid address format');
  }
  res.sendFile(path.join(__dirname, '../public/summary.html'));
});

/**
 * Get Hyperlens.io address stats
 */
app.post('/api/hyperlens-address-stats', async (req, res) => {
  try {
    const { HyperlensAPI } = await import('./api/hyperlens.js');
    const hyperlensAPI = new HyperlensAPI();
    
    const stats = await hyperlensAPI.getAddressStats(req.body);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching address stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Hyperlens.io liquidations for address
 */
app.post('/api/hyperlens-liquidations', async (req, res) => {
  try {
    const { HyperlensAPI } = await import('./api/hyperlens.js');
    const hyperlensAPI = new HyperlensAPI();
    
    const liquidations = await hyperlensAPI.getLiquidations(req.body);
    res.json(liquidations);
  } catch (error) {
    console.error('Error fetching liquidations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Hyperlens.io portfolio data for address
 */
app.post('/api/hyperlens-portfolio', async (req, res) => {
  try {
    const { HyperlensAPI } = await import('./api/hyperlens.js');
    const hyperlensAPI = new HyperlensAPI();
    
    const portfolio = await hyperlensAPI.getPortfolioData(req.body.address);
    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Hyperlens.io positions data for address
 */
app.post('/api/hyperlens-positions', async (req, res) => {
  try {
    const { HyperlensAPI } = await import('./api/hyperlens.js');
    const hyperlensAPI = new HyperlensAPI();
    
    const positions = await hyperlensAPI.getPositionsData(req.body.address);
    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Hyperlens.io fills for address
 */
app.post('/api/hyperlens-fills', async (req, res) => {
  try {
    const { HyperlensAPI } = await import('./api/hyperlens.js');
    const hyperlensAPI = new HyperlensAPI();
    
    const fills = await hyperlensAPI.getFills(req.body);
    res.json(fills);
  } catch (error) {
    console.error('Error fetching fills:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Hyperlens.io performance data for address
 */
app.post('/api/hyperlens-performance', async (req, res) => {
  try {
    const { HyperlensAPI } = await import('./api/hyperlens.js');
    const hyperlensAPI = new HyperlensAPI();
    
    // Get performance for major coins
    const coins = ['ETH', 'BTC', 'SOL'];
    const performance = [];
    
    for (const coin of coins) {
      try {
        const coinPerf = await hyperlensAPI.getAddressPerformanceByCoin(req.body.address, coin);
        if (coinPerf && coinPerf.length > 0) {
          performance.push(coinPerf[0]);
        }
      } catch (error) {
        console.log(`Error fetching ${coin} performance:`, error.message);
      }
    }
    
    res.json(performance);
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger manual address discovery
 */
app.post('/api/discover-addresses', async (req, res) => {
  try {
    console.log('🔍 Manual address discovery triggered via API');
    const discoveredAddresses = await monitor.findActiveAddressesFromTrades();
    
    res.json({ 
      success: true, 
      discovered: discoveredAddresses.length,
      addresses: discoveredAddresses.slice(0, 10), // Return first 10 for preview
      stats: monitor.stats.discoveryStats,
      whalesTracked: monitor.stats.whalesTracked,
      totalStats: monitor.stats
    });
  } catch (error) {
    console.error('Error in manual discovery:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current prices
 */
app.get('/api/prices', (req, res) => {
  res.json(monitor.currentPrices);
});

// WebSocket connections for real-time updates
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  // Send initial data
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      stats: monitor.getStats(),
      heatmap: monitor.getHeatmap(),
      positions: monitor.whaleTracker.getAllPositions()
    }
  }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate() {
  const data = {
    type: 'update',
    data: {
      stats: monitor.getStats(),
      heatmap: monitor.getHeatmap(),
      positions: monitor.whaleTracker.getAllPositions(),
      alerts: monitor.alertManager.getAlertHistory(10),
      digestStats: monitor.digestManager.getCurrentStats()
    },
    timestamp: Date.now()
  };

  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Broadcast updates every 2 seconds for real-time feel
setInterval(broadcastUpdate, 2000);

// Keep service awake with external health check every 10 minutes
setInterval(async () => {
  try {
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL;
    if (externalUrl) {
      const response = await fetch(`${externalUrl}/api/stats`);
      if (response.ok) {
        console.log('🔄 Health check: Service is alive');
      }
    }
  } catch (error) {
    console.log('⚠️ Health check failed:', error.message);
  }
}, 10 * 60 * 1000); // Every 10 minutes

// Start server and monitor
async function startServer() {
  try {
    // Start monitoring
    monitor.start().catch(error => {
      console.error('Monitor error:', error);
    });

    // Start HTTP server
    server.listen(PORT, () => {
      const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://hyperliquid-whale-tracker.onrender.com';
      console.log(`\n🌐 Dashboard server running on port ${PORT}`);
      console.log(`📊 WebSocket server running on port ${PORT}`);
      console.log(`🚀 External URL: ${renderUrl}`);
      console.log(`\nAPI Endpoints:`);
      console.log(`  GET  /api/heatmap       - Get liquidation heatmap`);
      console.log(`  GET  /api/stats         - Get monitoring stats`);
      console.log(`  GET  /api/positions     - Get all positions`);
      console.log(`  GET  /api/whales        - Get top whales`);
      console.log(`  GET  /api/alerts        - Get alert history`);
      console.log(`  POST /api/addresses     - Add address to monitor\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  monitor.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();

