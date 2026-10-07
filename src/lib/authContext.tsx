'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  email: string;
  avatarColor: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  register: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  deleteAccount: (email: string) => Promise<void>;
}

const STORAGE_KEY_AUTH_USER = 'first_trade_current_user_v2';

const AVATAR_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  register: async () => ({ success: false }),
  login: async () => ({ success: false }),
  logout: () => {},
  deleteAccount: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Load active user session from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_AUTH_USER);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.email) {
          setCurrentUser({
            email: parsed.email.toLowerCase(),
            avatarColor: getAvatarColor(parsed.email),
          });
        }
      }
    } catch (e) {
      console.error('Failed to load session', e);
    }
  }, []);

  // Sign Up with Gmail / Email & Password
  const register = useCallback(async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please enter a valid Gmail / Email' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters' };
    }

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIGNUP', email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to sign up' };
      }

      const profile: UserProfile = {
        email: cleanEmail,
        avatarColor: getAvatarColor(cleanEmail),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true };
    } catch (e) {
      console.error('Sign up error', e);
      return { success: false, message: 'Could not connect to cloud server' };
    }
  }, []);

  // Sign In with Gmail / Email & Password
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please enter your Gmail / Email' };
    }

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIGNIN', email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to sign in' };
      }

      const profile: UserProfile = {
        email: cleanEmail,
        avatarColor: getAvatarColor(cleanEmail),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true };
    } catch (e) {
      console.error('Sign in error', e);
      return { success: false, message: 'Could not connect to cloud server' };
    }
  }, []);

  // Simple Logout (no switch account)
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    setCurrentUser(null);
  }, []);

  const deleteAccount = useCallback(async (email: string) => {
    try {
      await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', email }),
      });
      logout();
    } catch (e) {
      console.error('Failed to delete account', e);
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      register, 
      login, 
      logout, 
      deleteAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
