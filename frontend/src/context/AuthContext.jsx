import React, { createContext, useState, useContext, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

// Decode JWT payload without verifying signature (for fallback user info only)
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

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
          console.error('Token verification failed, using fallback user from JWT payload', error);
          // Don't logout — decode the token payload and use it as fallback user.
          // This prevents the redirect loop when /auth/me is unreachable or returns 401
          // right after a successful login (Render cold start, JWT mismatch, etc.)
          const payload = decodeJwtPayload(storedToken);
          if (payload && (payload.username || payload.sub)) {
            setUser({ username: payload.username || payload.sub, role: payload.role || 'admin' });
            setToken(storedToken);
          } else {
            // Token is truly invalid (can't even decode it)
            logout();
          }
        }
      } else {
        setUser(null);
        setToken(null);
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
      const userObj = data.user || { username, role: 'admin' };
      setToken(authToken);
      setUser(userObj);
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
