import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    setUser(data.user);
    return data.user;
  };
  const register = async (details) => {
    const { data } = await api.post('/auth/register', details);
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  };
  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
