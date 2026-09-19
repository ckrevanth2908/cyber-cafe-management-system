import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Terminals from './pages/Terminals';
import Allocate from './pages/Allocate';
import Sessions from './pages/Sessions';
import Printing from './pages/Printing';
import Billing from './pages/Billing';
import Revenue from './pages/Revenue';
import Admin from './pages/Admin';

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/terminals" element={<Terminals />} />
        <Route path="/allocate" element={<Allocate />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/printing" element={<Printing />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/revenue" element={<Revenue />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
