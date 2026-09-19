const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

function generateReceiptNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = uuidv4().slice(0, 6).toUpperCase();
  return `RCP-${dateStr}-${rand}`;
}

// GET /api/v1/billing/preview/:session_id
router.get('/preview/:session_id', authMiddleware, (req, res) => {
  const session = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone,
           t.terminal_number, tt.name as terminal_type_name
    FROM sessions s
    JOIN customers c ON s.customer_id = c.id
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE s.id = ?
  `).get(req.params.session_id);

  if (!session) {
    return res.status(404).json({ detail: 'Session not found' });
  }

  // Determine current duration & charge
  let durationMinutes = session.actual_duration_minutes || session.expected_duration_minutes;
  let sessionCharge = session.session_charge;

  if (session.status === 'active') {
    const now = new Date();
    const startTime = new Date(session.start_time);
    durationMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
    
    const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(session.terminal_type_name.toLowerCase());
    const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;
    sessionCharge = Number(((durationMinutes / 60) * hourlyRate).toFixed(2));
  }

  // Unpaid print jobs for this customer
  const unpaidPrints = db.prepare(`
    SELECT pt.*, p.name as printer_name
    FROM print_transactions pt
    LEFT JOIN printers p ON pt.printer_id = p.id
    WHERE pt.customer_id = ? AND pt.created_at >= ?
  `).all(session.customer_id, session.start_time);

  const printCharge = unpaidPrints.reduce((sum, p) => sum + p.total_amount, 0);
  const totalAmount = Number((sessionCharge + printCharge).toFixed(2));

  return res.json({
    session_id: session.id,
    customer_id: session.customer_id,
    customer_name: session.customer_name,
    terminal_number: session.terminal_number,
    terminal_type_name: session.terminal_type_name,
    start_time: session.start_time,
    duration_minutes: durationMinutes,
    session_charge: sessionCharge,
    print_charge: printCharge,
    print_items: unpaidPrints,
    total_amount: totalAmount
  });
});

// POST /api/v1/billing/finalize/:session_id
router.post('/finalize/:session_id', authMiddleware, (req, res) => {
  const { payment_method } = req.body;
  const session = db.prepare(`
    SELECT s.*, c.name as customer_name, tt.name as terminal_type_name
    FROM sessions s
    JOIN customers c ON s.customer_id = c.id
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE s.id = ?
  `).get(req.params.session_id);

  if (!session) {
    return res.status(404).json({ detail: 'Session not found' });
  }

  // Check if already paid
  const existingPayment = db.prepare('SELECT * FROM payments WHERE session_id = ?').get(session.id);
  if (existingPayment) {
    return res.json(existingPayment);
  }

  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(session.terminal_type_name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  let durationMinutes = session.actual_duration_minutes || session.expected_duration_minutes;
  let sessionCharge = session.session_charge;

  if (session.status === 'active') {
    const now = new Date();
    const startTime = new Date(session.start_time);
    durationMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
    sessionCharge = Number(((durationMinutes / 60) * hourlyRate).toFixed(2));
  }

  const receiptNum = generateReceiptNumber();
  const totalAmount = sessionCharge;

  const finalizeTx = db.transaction(() => {
    // End session if still active
    if (session.status === 'active') {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE sessions 
        SET actual_end_time = ?, actual_duration_minutes = ?, status = 'completed', session_charge = ?
        WHERE id = ?
      `).run(now, durationMinutes, sessionCharge, session.id);

      db.prepare(`
        UPDATE terminal_allocations 
        SET is_active = 0, released_at = ?
        WHERE session_id = ? AND is_active = 1
      `).run(now, session.id);

      db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(session.terminal_id);
    }

    // Insert payment record
    const payRes = db.prepare(`
      INSERT INTO payments (session_id, customer_id, payment_type, session_charge, print_charge, total_amount, payment_method, status, receipt_number)
      VALUES (?, ?, 'session', ?, 0, ?, ?, 'paid', ?)
    `).run(session.id, session.customer_id, sessionCharge, totalAmount, payment_method || 'cash', receiptNum);

    // Update daily revenue for the terminal type
    const today = new Date().toISOString().slice(0, 10);
    let revRecord = db.prepare('SELECT * FROM daily_revenue WHERE date = ?').get(today);
    if (!revRecord) {
      db.prepare('INSERT INTO daily_revenue (date) VALUES (?)').run(today);
    }

    const colMap = {
      browsing: 'browsing_revenue',
      gaming: 'gaming_revenue',
      academic: 'academic_revenue'
    };
    const col = colMap[session.terminal_type_name.toLowerCase()] || 'browsing_revenue';

    db.prepare(`
      UPDATE daily_revenue 
      SET ${col} = ${col} + ?,
          total_revenue = total_revenue + ?,
          num_sessions = num_sessions + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE date = ?
    `).run(totalAmount, totalAmount, today);

    return db.prepare('SELECT * FROM payments WHERE id = ?').get(payRes.lastInsertRowid);
  });

  const payment = finalizeTx();
  return res.status(201).json({
    ...payment,
    customer_name: session.customer_name,
    duration_minutes: durationMinutes,
    items: [
      { description: `${session.terminal_type_name} Terminal Session (${durationMinutes} mins)`, amount: sessionCharge }
    ]
  });
});

// GET /api/v1/billing/receipts
router.get('/receipts', authMiddleware, (req, res) => {
  const receipts = db.prepare(`
    SELECT p.*, c.name as customer_name, c.phone as customer_phone
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    ORDER BY p.id DESC
  `).all();
  return res.json(receipts);
});

module.exports = router;
