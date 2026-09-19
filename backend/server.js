require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { initDB, db } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Universal CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Import Routes
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const customersRouter = require('./routes/customers');
const terminalsRouter = require('./routes/terminals');
const ratesRouter = require('./routes/rates');
const printersRouter = require('./routes/printers');
const allocationsRouter = require('./routes/allocations');
const sessionsRouter = require('./routes/sessions');
const printingRouter = require('./routes/printing');
const billingRouter = require('./routes/billing');
const revenueRouter = require('./routes/revenue');

// Mount routes under canonical /api/v1/*
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/terminals', terminalsRouter);
app.use('/api/v1/rates', ratesRouter);
app.use('/api/v1/printers', printersRouter);
app.use('/api/v1/allocations', allocationsRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/printing', printingRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/revenue', revenueRouter);

// Fallback compatibility mounts /api/*
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/customers', customersRouter);
app.use('/api/terminals', terminalsRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/printers', printersRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/printing', printingRouter);
app.use('/api/billing', billingRouter);
app.use('/api/revenue', revenueRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Static Frontend Serving (in Unified Production on Render)
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'CyberCafe Pro API',
      status: 'online',
      version: '2.0.0',
      endpoints: '/api/v1'
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err.message || err);
  res.status(500).json({ detail: err.message || 'Internal server error' });
});

async function startServer() {
  await initDB();

  // Background Worker: Auto-Expire Sessions (Runs every 30 seconds)
  cron.schedule('*/30 * * * * *', () => {
    try {
      const now = new Date().toISOString();
      const expiredSessions = db.prepare(`
        SELECT s.*, t.type_id, tt.name as type_name
        FROM sessions s
        JOIN terminals t ON s.terminal_id = t.id
        JOIN terminal_types tt ON t.type_id = tt.id
        WHERE s.status = 'active' AND s.expected_end_time <= ?
      `).all(now);

      if (expiredSessions.length > 0) {
        console.log(`[Scheduler] Auto-expiring ${expiredSessions.length} sessions...`);
        for (const sess of expiredSessions) {
          const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get((sess.type_name || 'browsing').toLowerCase());
          const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;
          const charge = Number(((sess.expected_duration_minutes / 60) * hourlyRate).toFixed(2));

          const expireTx = db.transaction(() => {
            db.prepare(`
              UPDATE sessions 
              SET actual_end_time = expected_end_time, actual_duration_minutes = expected_duration_minutes, status = 'completed', session_charge = ?
              WHERE id = ?
            `).run(charge, sess.id);

            db.prepare(`
              UPDATE terminal_allocations 
              SET is_active = 0, released_at = ?
              WHERE session_id = ? AND is_active = 1
            `).run(now, sess.id);

            db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(sess.terminal_id);
          });

          expireTx();
        }
      }
    } catch (err) {
      console.error('[Scheduler Error]', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 CyberCafe Pro Backend listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
