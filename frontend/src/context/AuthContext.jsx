import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

// Decode JWT payload client-side (no signature check — just for display info)
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const storedToken = localStorage.getItem('cyber_cafe_token');
  const [token, setToken] = useState(
    storedToken && storedToken !== 'undefined' && storedToken !== 'null' ? storedToken : null
  );
  const [user, setUser] = useState(() => {
    // Try to hydrate user from the stored JWT payload immediately (no network needed)
    if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
      const payload = decodeJwtPayload(storedToken);
      if (payload && (payload.username || payload.sub)) {
        return { username: payload.username || payload.sub, role: payload.role || 'admin', id: payload.id };
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!!token); // only show loading if there's a token to verify
  const justLoggedIn = useRef(false);

  useEffect(() => {
    // Only run if we have a token but got user from payload (need to enrich with full data from server)
    if (!token) {
      setIsLoading(false);
      return;
    }

    // If we just logged in, skip the verify — login() already set user
    if (justLoggedIn.current) {
      justLoggedIn.current = false;
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const userData = await authApi.getMe();
        setUser(userData);
      } catch (error) {
        console.warn('Token verify via /auth/me failed — keeping JWT payload user:', error?.response?.status);
        // DO NOT logout. We already set user from JWT payload above.
        // The user can still use the app; individual API calls will fail if token is truly bad.
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []); // run once on mount only

  const login = async (username, password) => {
    try {
      const data = await authApi.login(username, password);
      const authToken = data.token || data.access_token;
      if (!authToken) throw new Error('No token returned from server');

      justLoggedIn.current = true; // prevent verifyToken from running again and clearing state
      localStorage.setItem('cyber_cafe_token', authToken);

      const userObj = data.user || { username, role: 'admin' };
      // Set both synchronously so isAuthenticated is true before navigate()
      setToken(authToken);
      setUser(userObj);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message ||
          'Invalid username or password',
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cyber_cafe_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        // Authenticated if we have a token — user is hydrated synchronously from JWT payload
        isAuthenticated: !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
