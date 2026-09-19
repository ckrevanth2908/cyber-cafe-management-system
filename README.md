# 🖥️ Internet Café Management System

A full-stack, responsive web application for managing computer terminals, customer sessions, printing/Xerox services, dynamic billing, waiting queues, and daily revenue reporting in an internet café.

---

## 🌟 Key Features

1. **System & Terminal Management**:
   - Categorized terminal types: **Browsing**, **Gaming**, and **Academic**
   - Individual terminal configuration with real-time status (**Available**, **Occupied**, **Maintenance**)
   - Instant conflict-free terminal allocation

2. **Customer Registration & Session Management**:
   - Customer details validation (Name, Age, Phone, Email, Address)
   - Age verification (configurable age restrictions for gaming activities)
   - Real-time countdown timer & session warnings
   - Automatic session expiry and terminal release

3. **Waiting List Queue**:
   - Automated queue management when terminals of a requested type are full
   - Dynamic Estimated Wait Time (ETA) calculation
   - Automatic allocation when a terminal becomes free

4. **Printing & Xerox Services**:
   - Instantaneous service logging (Plain B&W, Colour, Xerox)
   - Automatic cost calculation based on page counts and service rates

5. **Dynamic Billing & Invoicing**:
   - Automated usage duration and charge computation
   - Itemized bill preview (Terminal usage + Print charges)
   - Printable receipt generation with unique receipt codes (`RCP-YYYYMMDD-XXXXXX`)

6. **Daily Revenue Reporting**:
   - Visual charts (Recharts) and daily service-wise breakdowns
   - Date-range revenue summaries & CSV export capability

7. **Admin Configuration**:
   - Service rate card management per hour/page
   - Printer/Xerox hardware configuration
   - Café branding & system age settings

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│              React 18 + Vite + Tailwind CSS                  │
│         (Login, Dashboard, Customers, Terminals,             │
│          Sessions, Queue, Printing, Billing, Revenue, Admin) │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JSON / JWT)
┌──────────────────────────▼──────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                      │
│                  Node.js + Express.js                        │
│   (Terminal Allocation, Auto-Expiry Scheduler, Billing,      │
│    Waiting Queue Manager, Revenue Aggregator)                │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQLite Engine (WAL mode)
┌──────────────────────────▼──────────────────────────────────┐
│                      DATABASE LAYER                          │
│                    SQLite (cybercafe.db)                     │
│   13 Normalized Tables: customers, terminals, sessions,      │
│   allocations, queue, print_transactions, payments, etc.     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js (LTS version 18 or 20+)](https://nodejs.org/)

---

### 1. Backend Setup

```bash
# Open terminal and go to backend
cd backend

# Install dependencies
npm install

# Start the backend server (runs on http://localhost:5000)
npm start
```

*Default Admin Credentials seeded automatically:*
- **Username:** `admin`
- **Password:** `admin123`

---

### 2. Frontend Setup

```bash
# Open a second terminal and go to frontend
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

*Open your browser and visit:* **http://localhost:5173**

---

## 📁 Project Structure

```
├── backend/
│   ├── database/
│   │   └── db.js            # SQLite table schema & seed logic
│   ├── middleware/
│   │   └── auth.js          # JWT authentication & admin guard
│   ├── routes/
│   │   ├── auth.js          # Login & user endpoints
│   │   ├── admin.js         # Stats & system configuration
│   │   ├── customers.js     # Customer registration & lookup
│   │   ├── terminals.js     # Terminal CRUD & status controls
│   │   ├── rates.js         # Service pricing rates
│   │   ├── printers.js      # Printer & Xerox setup
│   │   ├── allocations.js   # Terminal allocation & release logic
│   │   ├── sessions.js      # Active session tracking & termination
│   │   ├── queue.js         # Waiting queue & ETA calculation
│   │   ├── printing.js      # Print & copy transaction recording
│   │   ├── billing.js       # Bill calculation & payment receipts
│   │   └── revenue.js       # Daily & range-based revenue metrics
│   ├── server.js            # Express app & background cron jobs
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API client functions
│   │   ├── components/      # Reusable UI widgets & modals
│   │   ├── context/         # AuthContext (JWT management)
│   │   ├── pages/           # Dashboard, Terminals, Billing, etc.
│   │   ├── App.jsx          # Protected route hierarchy
│   │   └── main.jsx         # App bootstrap with QueryClient
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## 🛡️ API Endpoints Summary

| Module | Route | Method | Description |
|---|---|---|---|
| **Auth** | `/api/v1/auth/login` | `POST` | Authenticate user & receive JWT |
| **Admin** | `/api/v1/admin/stats` | `GET` | Dashboard real-time counters |
| **Customers** | `/api/v1/customers` | `GET/POST` | List, search & register customers |
| **Terminals** | `/api/v1/terminals` | `GET/POST/PUT` | Terminal management & status updates |
| **Allocations** | `/api/v1/allocations` | `POST` | Conflict-free terminal assignment |
| **Sessions** | `/api/v1/sessions/active` | `GET` | Real-time active sessions |
| **Queue** | `/api/v1/queue` | `GET/POST` | Waiting queue with ETA calculation |
| **Printing** | `/api/v1/printing` | `GET/POST` | Instant print/xerox operations |
| **Billing** | `/api/v1/billing/finalize/:id` | `POST` | Finalize session bill & generate receipt |
| **Revenue** | `/api/v1/revenue/daily` | `GET` | Service-wise daily revenue breakdown |
