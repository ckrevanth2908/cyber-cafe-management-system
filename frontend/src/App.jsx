import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Terminals from './pages/Terminals';
import Allocate from './pages/Allocate';
import Sessions from './pages/Sessions';
import Queue from './pages/Queue';
import Printing from './pages/Printing';
import Billing from './pages/Billing';
import Revenue from './pages/Revenue';
import Admin from './pages/Admin';
import LoadingSpinner from './components/LoadingSpinner';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/terminals" element={<Terminals />} />
        <Route path="/allocate" element={<Allocate />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/queue" element={<Queue />} />
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
