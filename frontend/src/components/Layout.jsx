import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Monitor, 
  Clock, 
  PlayCircle, 
  Printer, 
  Receipt, 
  LineChart, 
  Settings
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Terminals', path: '/terminals', icon: Monitor },
  { name: 'Allocate', path: '/allocate', icon: PlayCircle },
  { name: 'Sessions', path: '/sessions', icon: Clock },
  { name: 'Printing', path: '/printing', icon: Printer },
  { name: 'Billing', path: '/billing', icon: Receipt },
  { name: 'Revenue', path: '/revenue', icon: LineChart },
  { name: 'Admin', path: '/admin', icon: Settings },
];

const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-center">
          <Monitor className="w-8 h-8 text-accent mr-3" />
          <h1 className="text-xl font-bold">CyberCafe Pro</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary-dark text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex justify-between items-center px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Cyber Café Management System
            </h2>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
