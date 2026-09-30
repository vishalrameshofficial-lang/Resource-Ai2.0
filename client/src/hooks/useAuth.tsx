import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, AuthState, UserRole } from '../types/auth';
import { api } from '../lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  switchRoleQuickly: (role: UserRole) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('resourceai_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success && res.user) {
            setUser(res.user);
          } else {
            await autoLoginDefaultAdmin();
          }
        } catch {
          await autoLoginDefaultAdmin();
        }
      } else {
        await autoLoginDefaultAdmin();
      }
      setIsLoading(false);
    }
    checkAuth();
  }, []);

  async function autoLoginDefaultAdmin() {
    try {
      const res = await api.login('admin@resourceai.org', 'admin123');
      if (res.token) {
        localStorage.setItem('resourceai_token', res.token);
        setToken(res.token);
        setUser(res.user);
      }
    } catch (e) {
      console.warn('Auto-login error:', e);
    }
  }

  async function login(email: string, pass: string) {
    const res = await api.login(email, pass);
    if (res.token) {
      localStorage.setItem('resourceai_token', res.token);
      setToken(res.token);
      setUser(res.user);
    }
  }

  async function switchRoleQuickly(role: UserRole) {
    const creds: Record<UserRole, { email: string; pass: string }> = {
      ADMIN: { email: 'admin@resourceai.org', pass: 'admin123' },
      OPERATOR: { email: 'operator@resourceai.org', pass: 'operator123' },
      VIEWER: { email: 'viewer@resourceai.org', pass: 'viewer123' }
    };
    const c = creds[role];
    await login(c.email, c.pass);
  }

  function logout() {
    localStorage.removeItem('resourceai_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
        switchRoleQuickly
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
