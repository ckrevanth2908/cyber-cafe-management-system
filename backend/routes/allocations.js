const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

function calculateSessionCharge(durationMinutes, ratePerHour) {
  return Number(((durationMinutes / 60) * ratePerHour).toFixed(2));
}

// POST /api/v1/allocations
router.post('/', (req, res) => {
  const customerId = req.body.customer_id || req.body.customerId;
  let terminalTypeId = req.body.terminal_type_id || req.body.terminalTypeId;
  const durationMinutes = parseInt(req.body.duration_minutes || req.body.durationMinutes || req.body.duration || req.body.expectedDurationMinutes || 60, 10);
  let terminalId = req.body.terminal_id || req.body.terminalId;
  const systemType = (req.body.system_type || req.body.systemType || 'browsing').toLowerCase();

  if (!customerId) {
    return res.status(400).json({ detail: 'Please select a customer first' });
  }

  // Ensure Customer exists, or create a default one if needed
  let customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    const defaultCust = db.prepare('SELECT * FROM customers LIMIT 1').get();
    if (defaultCust) {
      customer = defaultCust;
    } else {
      const newCust = db.prepare('INSERT INTO customers (name, age, phone) VALUES (?, ?, ?)').run('Walk-in Customer', 21, '9999999999');
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(newCust.lastInsertRowid);
    }
  }

  // Resolve terminal type
  let termType = null;
  if (terminalTypeId) {
    termType = db.prepare('SELECT * FROM terminal_types WHERE id = ?').get(terminalTypeId);
  }
  if (!termType && systemType) {
    termType = db.prepare('SELECT * FROM terminal_types WHERE LOWER(name) = ? OR name LIKE ?').get(systemType, `%${systemType}%`);
  }
  if (!termType) {
    termType = db.prepare('SELECT * FROM terminal_types WHERE LOWER(name) = ?').get('browsing');
    if (!termType) {
      const ins = db.prepare('INSERT INTO terminal_types (name, description) VALUES (?, ?)').run('Browsing', 'Standard internet');
      termType = { id: ins.lastInsertRowid, name: 'Browsing' };
    }
  }
  terminalTypeId = termType.id;

  // Find an available terminal for this type
  let term = null;
  if (terminalId) {
    term = db.prepare('SELECT * FROM terminals WHERE id = ? AND status = ?').get(terminalId, 'available');
  }

  if (!term) {
    term = db.prepare('SELECT * FROM terminals WHERE type_id = ? AND status = ? ORDER BY id ASC LIMIT 1').get(terminalTypeId, 'available');
  }

  // If no available terminal exists for this type, create one automatically or free an available one
  if (!term) {
    const prefix = termType.name.charAt(0).toUpperCase();
    const count = db.prepare('SELECT COUNT(*) as cnt FROM terminals WHERE type_id = ?').get(terminalTypeId).cnt;
    const newTermNumber = `${prefix}-0${count + 1}`;
    
    // Check if terminal number exists
    const exists = db.prepare('SELECT * FROM terminals WHERE terminal_number = ?').get(newTermNumber);
    if (!exists) {
      const insTerm = db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run(
        newTermNumber,
        terminalTypeId,
        `${termType.name} High-Performance PC`,
        'available'
      );
      term = db.prepare('SELECT * FROM terminals WHERE id = ?').get(insTerm.lastInsertRowid);
    } else {
      // Force status to available for assignment
      db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(exists.id);
      term = exists;
    }
  }

  // Get hourly rate
  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(termType.name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  const startTime = new Date();
  const expectedEndTime = new Date(startTime.getTime() + durationMinutes * 60000);

  // Atomic Allocation Transaction
  const allocateTx = db.transaction(() => {
    // 1. Create Session
    const sessionRes = db.prepare(`
      INSERT INTO sessions (customer_id, terminal_id, start_time, expected_end_time, expected_duration_minutes, status, session_charge)
      VALUES (?, ?, ?, ?, ?, 'active', 0)
    `).run(customer.id, term.id, startTime.toISOString(), expectedEndTime.toISOString(), durationMinutes);

    const sessionId = sessionRes.lastInsertRowid;

    // 2. Mark Terminal as Occupied
    db.prepare("UPDATE terminals SET status = 'occupied' WHERE id = ?").run(term.id);

    // 3. Create Allocation record
    const allocRes = db.prepare(`
      INSERT INTO terminal_allocations (terminal_id, session_id, customer_id, allocated_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(term.id, sessionId, customer.id, startTime.toISOString());

    // 4. Mark queue entry as allocated if existing
    db.prepare("UPDATE waiting_queue SET status = 'allocated' WHERE customer_id = ? AND terminal_type_id = ? AND status = 'waiting'").run(customer.id, terminalTypeId);

    return {
      id: allocRes.lastInsertRowid,
      terminal_id: term.id,
      session_id: sessionId,
      customer_id: customer.id,
      terminal_number: term.terminal_number,
      terminal_type_name: termType.name,
      customer_name: customer.name,
      start_time: startTime.toISOString(),
      expected_end_time: expectedEndTime.toISOString(),
      expected_duration_minutes: durationMinutes,
      hourly_rate: hourlyRate,
      status: 'active'
    };
  });

  try {
    const allocation = allocateTx();
    return res.status(201).json(allocation);
  } catch (err) {
    console.error('Allocation error:', err);
    return res.status(500).json({ detail: 'Failed to allocate terminal: ' + err.message });
  }
});

// GET /api/v1/allocations/active
router.get('/active', (req, res) => {
  const activeAllocations = db.prepare(`
    SELECT ta.*, t.terminal_number, tt.name as terminal_type_name, c.name as customer_name,
           s.start_time, s.expected_end_time, s.expected_duration_minutes
    FROM terminal_allocations ta
    JOIN terminals t ON ta.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    JOIN customers c ON ta.customer_id = c.id
    JOIN sessions s ON ta.session_id = s.id
    WHERE ta.is_active = 1
    ORDER BY ta.id DESC
  `).all();
  return res.json(activeAllocations);
});

// POST /api/v1/allocations/:id/release
router.post('/:id/release', (req, res) => {
  const alloc = db.prepare('SELECT * FROM terminal_allocations WHERE id = ?').get(req.params.id);
  if (!alloc || !alloc.is_active) {
    return res.status(404).json({ detail: 'Active allocation not found' });
  }

  const now = new Date();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(alloc.session_id);
  const term = db.prepare('SELECT t.*, tt.name as type_name FROM terminals t JOIN terminal_types tt ON t.type_id = tt.id WHERE t.id = ?').get(alloc.terminal_id);
  const rateRow = db.prepare('SELECT rate_per_unit FROM service_rates WHERE service_type = ?').get(term.type_name.toLowerCase());
  const hourlyRate = rateRow ? rateRow.rate_per_unit : 20.0;

  const startTime = new Date(session.start_time);
  const actualMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
  const charge = calculateSessionCharge(actualMinutes, hourlyRate);

  const releaseTx = db.transaction(() => {
    db.prepare(`
      UPDATE sessions 
      SET actual_end_time = ?, actual_duration_minutes = ?, status = 'completed', session_charge = ?
      WHERE id = ?
    `).run(now.toISOString(), actualMinutes, charge, session.id);

    db.prepare(`
      UPDATE terminal_allocations 
      SET is_active = 0, released_at = ?
      WHERE id = ?
    `).run(now.toISOString(), alloc.id);

    db.prepare("UPDATE terminals SET status = 'available' WHERE id = ?").run(alloc.terminal_id);
  });

  releaseTx();
  return res.json({ detail: 'Terminal released and session ended successfully', session_id: session.id, charge });
});

module.exports = router;
