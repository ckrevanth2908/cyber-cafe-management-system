import React, { createContext, useState, useContext, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cyber_cafe_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('cyber_cafe_token');
      if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          console.error("Token verification failed", error);
          logout();
        }
      } else {
        logout();
      }
      setIsLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authApi.login(username, password);
      const authToken = data.token || data.access_token;
      if (!authToken) {
        throw new Error('No token returned from server');
      }

      localStorage.setItem('cyber_cafe_token', authToken);
      setToken(authToken);
      setUser(data.user || { username, role: 'admin' });
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || error.response?.data?.message || error.message || 'Invalid username or password' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cyber_cafe_token');
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
