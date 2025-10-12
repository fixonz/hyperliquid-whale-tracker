import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LiquidationMonitor } from './monitor.js';
import telegramWebhook from './telegramWebhook.js';

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
app.get('/api/whales', (req, res) => {
  const count = parseInt(req.query.count) || 20;
  const whales = monitor.whaleTracker.getTopWhales(count);
  res.json(whales);
});

/**
 * Get whale data by address
 */
app.get('/api/whales/:address', (req, res) => {
  const whale = monitor.whaleTracker.getWhale(req.params.address);
  if (!whale) {
    return res.status(404).json({ error: 'Whale not found' });
  }
  res.json(whale);
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
      alerts: monitor.alertManager.getAlertHistory(10)
    },
    timestamp: Date.now()
  };

  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Broadcast updates every 5 seconds
setInterval(broadcastUpdate, 5000);

// Start server and monitor
async function startServer() {
  try {
    // Start monitoring
    monitor.start().catch(error => {
      console.error('Monitor error:', error);
    });

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`\n🌐 Dashboard server running on http://localhost:${PORT}`);
      console.log(`📊 WebSocket server running on ws://localhost:${PORT}`);
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

