const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/v1/customers
router.get('/', authMiddleware, (req, res) => {
  const { search } = req.query;
  let customers;
  if (search) {
    const q = `%${search}%`;
    customers = db.prepare(`
      SELECT * FROM customers 
      WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
      ORDER BY id DESC
    `).all(q, q, q);
  } else {
    customers = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  }
  return res.json(customers);
});

// POST /api/v1/customers
router.post('/', authMiddleware, (req, res) => {
  const { name, age, address, phone, email } = req.body;
  if (!name || age === undefined || age === null) {
    return res.status(400).json({ detail: 'Name and age are required' });
  }

  const result = db.prepare(`
    INSERT INTO customers (name, age, address, phone, email)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, age, address || '', phone || '', email || '');

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(customer);
});

// GET /api/v1/customers/:id
router.get('/:id', authMiddleware, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ detail: 'Customer not found' });
  }

  const sessions = db.prepare(`
    SELECT s.*, t.terminal_number, tt.name as terminal_type_name
    FROM sessions s
    JOIN terminals t ON s.terminal_id = t.id
    JOIN terminal_types tt ON t.type_id = tt.id
    WHERE s.customer_id = ?
    ORDER BY s.id DESC
  `).all(req.params.id);

  const printTransactions = db.prepare(`
    SELECT pt.*, p.name as printer_name
    FROM print_transactions pt
    LEFT JOIN printers p ON pt.printer_id = p.id
    WHERE pt.customer_id = ?
    ORDER BY pt.id DESC
  `).all(req.params.id);

  return res.json({
    ...customer,
    sessions,
    print_transactions: printTransactions
  });
});

// PUT /api/v1/customers/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { name, age, address, phone, email } = req.body;
  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ detail: 'Customer not found' });
  }

  db.prepare(`
    UPDATE customers
    SET name = COALESCE(?, name),
        age = COALESCE(?, age),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email)
    WHERE id = ?
  `).run(name, age, address, phone, email, req.params.id);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  return res.json(updated);
});

module.exports = router;
