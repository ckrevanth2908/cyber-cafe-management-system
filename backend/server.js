require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDB, db } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/customers', require('./routes/customers'));
app.use('/api/v1/terminals', require('./routes/terminals'));
app.use('/api/v1/rates', require('./routes/rates'));
app.use('/api/v1/printers', require('./routes/printers'));
app.use('/api/v1/allocations', require('./routes/allocations'));
app.use('/api/v1/sessions', require('./routes/sessions'));
app.use('/api/v1/queue', require('./routes/queue'));
app.use('/api/v1/printing', require('./routes/printing'));
app.use('/api/v1/billing', require('./routes/billing'));
app.use('/api/v1/revenue', require('./routes/revenue'));

const path = require('path');
const fs = require('fs');

// Static Frontend Serving (in Production / on Render)
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Cyber Cafe Management API (Node.js)', version: '1.0.0', status: 'running' });
  });
}

async function startServer() {
  await initDB();

  // Background Worker: Auto-Expire Sessions (Runs every 30 seconds)
  cron.schedule('*/30 * * * * *', () => {
    try {
      const now = new Date();
      const expiredSessions = db.prepare(`
        SELECT s.*, t.type_id, tt.name as type_name
        FROM sessions s
        JOIN terminals t ON s.terminal_id = t.id
        JOIN terminal_types tt ON t.type_id = tt.id
        WHERE s.status = 'active' AND s.expected_end_time <= ?
      `).all(now.toISOString());

      for (const sess of expiredSessions) {
        const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(sess.type_name.toLowerCase());
        const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;
        const charge = Number(((sess.expected_duration_minutes / 60) * hourlyRate).toFixed(2));

        db.transaction(() => {
          // Mark session completed/expired
          db.prepare(`
            UPDATE sessions 
            SET actual_end_time = ?, actual_duration_minutes = expected_duration_minutes, status = 'completed', session_charge = ?
            WHERE id = ?
          `).run(now.toISOString(), charge, sess.id);

          // Release allocation
          db.prepare(`
            UPDATE terminal_allocations 
            SET is_active = 0, released_at = ?
            WHERE session_id = ? AND is_active = 1
          `).run(now.toISOString(), sess.id);

          // Make terminal available
          db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(sess.terminal_id);
        })();

        console.log(`[Auto-Expire] Session #${sess.id} expired. Terminal #${sess.terminal_id} released.`);
      }

      // Auto-Process Waiting Queue for any newly freed terminals
      const waitingItems = db.prepare(`
        SELECT q.*, c.name as customer_name, tt.name as type_name
        FROM waiting_queue q
        JOIN customers c ON q.customer_id = c.id
        JOIN terminal_types tt ON q.terminal_type_id = tt.id
        WHERE q.status = 'waiting'
        ORDER BY q.priority DESC, q.id ASC
      `).all();

      for (const item of waitingItems) {
        const availableTerm = db.prepare('SELECT * FROM terminals WHERE type_id = ? AND status = ? ORDER BY id ASC LIMIT 1')
          .get(item.terminal_type_id, 'available');

        if (availableTerm) {
          const startTime = new Date();
          const endTime = new Date(startTime.getTime() + item.expected_duration_minutes * 60000);

          db.transaction(() => {
            const sessRes = db.prepare(`
              INSERT INTO sessions (customer_id, terminal_id, start_time, expected_end_time, expected_duration_minutes, status, session_charge)
              VALUES (?, ?, ?, ?, ?, 'active', 0)
            `).run(item.customer_id, availableTerm.id, startTime.toISOString(), endTime.toISOString(), item.expected_duration_minutes);

            db.prepare("UPDATE terminals SET status = 'occupied' WHERE id = ?").run(availableTerm.id);

            db.prepare(`
              INSERT INTO terminal_allocations (terminal_id, session_id, customer_id, allocated_at, is_active)
              VALUES (?, ?, ?, ?, 1)
            `).run(availableTerm.id, sessRes.lastInsertRowid, item.customer_id, startTime.toISOString());

            db.prepare("UPDATE waiting_queue SET status = 'allocated' WHERE id = ?").run(item.id);
          })();

          console.log(`[Queue Processor] Allocated Terminal #${availableTerm.terminal_number} to Customer ${item.customer_name}`);
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 Cyber Cafe Backend running on http://localhost:${PORT}`);
  });
}

startServer();
