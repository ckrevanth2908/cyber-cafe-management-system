const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbFilePath = path.resolve(process.env.DB_PATH || './database/cybercafe.db');
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let rawDb = null;

function saveDbToDisk() {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('[DB Persist Error]', err.message);
  }
}

const db = {
  exec(sql) {
    if (!rawDb) throw new Error('Database not initialized');
    rawDb.exec(sql);
    saveDbToDisk();
  },
  prepare(sql) {
    return {
      all(...params) {
        if (!rawDb) throw new Error('Database not initialized');
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      get(...params) {
        if (!rawDb) throw new Error('Database not initialized');
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      run(...params) {
        if (!rawDb) throw new Error('Database not initialized');
        rawDb.run(sql, params);
        let lastInsertRowid = null;
        try {
          const lastIdRes = rawDb.exec('SELECT last_insert_rowid() as id');
          if (lastIdRes.length && lastIdRes[0].values.length) {
            lastInsertRowid = lastIdRes[0].values[0][0];
          }
        } catch (e) {
          // ignore
        }
        saveDbToDisk();
        return { lastInsertRowid };
      }
    };
  },
  transaction(fn) {
    return (...args) => {
      if (!rawDb) throw new Error('Database not initialized');
      rawDb.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        rawDb.run('COMMIT');
        saveDbToDisk();
        return result;
      } catch (err) {
        try { rawDb.run('ROLLBACK'); } catch (e) {}
        throw err;
      }
    };
  }
};

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(dbFilePath);
      rawDb = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read existing database file, creating fresh database.');
      rawDb = new SQL.Database();
    }
  } else {
    rawDb = new SQL.Database();
  }

  // Create clean schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cafe_name TEXT DEFAULT 'CyberCafe Pro',
      address TEXT DEFAULT '100 Technology Boulevard, Suite 4',
      phone TEXT DEFAULT '+91 98765 43210',
      email TEXT DEFAULT 'contact@cybercafepro.in',
      age_restriction_gaming INTEGER DEFAULT 15,
      session_warning_minutes INTEGER DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS terminal_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS terminals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terminal_number TEXT UNIQUE NOT NULL,
      type_id INTEGER NOT NULL,
      specifications TEXT,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES terminal_types(id)
    );

    CREATE TABLE IF NOT EXISTS service_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type TEXT UNIQUE NOT NULL,
      rate_per_unit REAL NOT NULL,
      unit TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      terminal_id INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_end_time DATETIME NOT NULL,
      actual_end_time DATETIME,
      expected_duration_minutes INTEGER NOT NULL,
      actual_duration_minutes INTEGER,
      status TEXT DEFAULT 'active',
      session_charge REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (terminal_id) REFERENCES terminals(id)
    );

    CREATE TABLE IF NOT EXISTS terminal_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terminal_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (terminal_id) REFERENCES terminals(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS printers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      printer_type TEXT NOT NULL,
      specifications TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS print_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      printer_id INTEGER,
      service_type TEXT NOT NULL,
      num_pages INTEGER NOT NULL,
      cost_per_page REAL NOT NULL,
      total_amount REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (printer_id) REFERENCES printers(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      customer_id INTEGER NOT NULL,
      payment_type TEXT NOT NULL,
      session_charge REAL DEFAULT 0,
      print_charge REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'paid',
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      receipt_number TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS daily_revenue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      browsing_revenue REAL DEFAULT 0,
      gaming_revenue REAL DEFAULT 0,
      academic_revenue REAL DEFAULT 0,
      plain_print_revenue REAL DEFAULT 0,
      colour_print_revenue REAL DEFAULT 0,
      xerox_revenue REAL DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      num_customers INTEGER DEFAULT 0,
      num_sessions INTEGER DEFAULT 0,
      num_print_transactions INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Terminal Types
  const types = db.prepare('SELECT id FROM terminal_types').all();
  if (types.length === 0) {
    db.prepare('INSERT INTO terminal_types (name, description) VALUES (?, ?)').run('Browsing', 'High-speed internet & general workstation');
    db.prepare('INSERT INTO terminal_types (name, description) VALUES (?, ?)').run('Gaming', 'RTX 4070 GPU & high-refresh 240Hz display');
    db.prepare('INSERT INTO terminal_types (name, description) VALUES (?, ?)').run('Academic', 'Quiet zone for study, research & coding');
  }

  // Seed Default Terminals (6 PCs across 3 categories)
  const existingTerms = db.prepare('SELECT id FROM terminals').all();
  if (existingTerms.length === 0) {
    db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run('B-01', 1, 'Core i5, 16GB RAM, 100Mbps Fiber', 'available');
    db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run('B-02', 1, 'Core i5, 16GB RAM, 100Mbps Fiber', 'available');
    db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run('G-01', 2, 'Ryzen 7 7800X3D, RTX 4070, 32GB RAM, 240Hz', 'available');
    db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run('G-02', 2, 'Ryzen 7 7800X3D, RTX 4070, 32GB RAM, 240Hz', 'available');
    db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run('A-01', 3, 'Core i5, 16GB RAM, Office Suite & IDEs', 'available');
    db.prepare('INSERT INTO terminals (terminal_number, type_id, specifications, status) VALUES (?, ?, ?, ?)').run('A-02', 3, 'Core i5, 16GB RAM, Office Suite & IDEs', 'available');
  }

  // Seed Service Rates in INR
  const rates = db.prepare('SELECT id FROM service_rates').all();
  if (rates.length === 0) {
    const insRate = db.prepare('INSERT INTO service_rates (service_type, rate_per_unit, unit, description) VALUES (?, ?, ?, ?)');
    insRate.run('browsing', 20.0, 'hour', 'Standard browsing per hour');
    insRate.run('gaming', 50.0, 'hour', 'Gaming terminal per hour');
    insRate.run('academic', 15.0, 'hour', 'Academic zone per hour');
    insRate.run('plain_print', 2.0, 'page', 'Black & white printing per page');
    insRate.run('colour_print', 10.0, 'page', 'Colour printing per page');
    insRate.run('xerox', 1.0, 'page', 'Photocopying per page');
  }

  // Seed Printers
  const printers = db.prepare('SELECT id FROM printers').all();
  if (printers.length === 0) {
    db.prepare('INSERT INTO printers (name, printer_type, specifications) VALUES (?, ?, ?)').run('HP LaserJet Pro M404dn', 'plain', 'High-Speed B&W Laser, 40ppm');
    db.prepare('INSERT INTO printers (name, printer_type, specifications) VALUES (?, ?, ?)').run('Epson EcoTank L3250', 'colour', 'Color Inkjet, High-Resolution');
    db.prepare('INSERT INTO printers (name, printer_type, specifications) VALUES (?, ?, ?)').run('Canon imageRUNNER 2206', 'xerox', 'Commercial Digital Photocopier');
  }

  // Seed System Config
  const cfg = db.prepare('SELECT id FROM system_config').get();
  if (!cfg) {
    db.prepare('INSERT INTO system_config (cafe_name) VALUES (?)').run('CyberCafe Pro');
  }

  // Seed Sample Customer if none exist
  const custCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (custCount === 0) {
    db.prepare('INSERT INTO customers (name, age, phone, email, address) VALUES (?, ?, ?, ?, ?)').run(
      'Rahul Sharma', 22, '+91 98765 43210', 'rahul.sharma@example.com', 'Sector 14, Main Road'
    );
  }

  // Auto-heal any orphaned occupied terminals on boot
  db.exec(`
    UPDATE terminals 
    SET status = 'available' 
    WHERE id NOT IN (
      SELECT terminal_id FROM sessions WHERE status = 'active'
    ) AND status = 'occupied';
  `);

  console.log('✅ Cyber Cafe Database initialized successfully with all tables and seeds.');
}

module.exports = { db, initDB };
