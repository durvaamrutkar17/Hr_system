import React, { useState, useEffect, useContext, createContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.user);
      setLoading(false);
    } catch (err) {
      localStorage.removeItem('token');
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login({ email, password });
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      return response.data.user;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      return response.data.user;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Called after a successful POST /api/auth/invite/:token/setup-password -
  // same shape as login/register (token + user), used to auto-login someone
  // who just accepted an invitation. See pages/AcceptInvite.js.
  const completeInviteSetup = (token, user) => {
    localStorage.setItem('token', token);
    setUser(user);
  };

  // Called after a successful POST /api/auth/reset-password while
  // mustResetPassword was set, so the app can drop the forced-reset gate
  // without requiring a fresh login. See pages/ForcePasswordReset.js.
  const clearMustResetPassword = () => {
    setUser((prev) => (prev ? { ...prev, mustResetPassword: false } : prev));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, completeInviteSetup, clearMustResetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
