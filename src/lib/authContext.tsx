'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  username: string;
  avatarColor: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: string[];
  register: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  deleteAccount: (username: string) => Promise<void>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
}

const STORAGE_KEY_AUTH_USER = 'first_trade_current_user';

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
  usersList: [],
  register: async () => ({ success: false }),
  login: async () => ({ success: false }),
  logout: () => {},
  deleteAccount: async () => {},
  isUsernameAvailable: async () => true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<string[]>([]);

  // 1. Fetch registered users from cloud Redis on mount
  const syncUsersList = useCallback(async () => {
    try {
      const res = await fetch('/api/user/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setUsersList(data.users);
        }
      }
    } catch (e) {
      console.error('Failed to fetch users from cloud', e);
    }
  }, []);

  useEffect(() => {
    // Load local active session
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_AUTH_USER);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.username) {
          setCurrentUser({
            username: parsed.username,
            avatarColor: getAvatarColor(parsed.username),
          });
        }
      }
    } catch {}

    syncUsersList();
  }, [syncUsersList]);

  // Check unique username availability via Cloud Redis
  const isUsernameAvailable = useCallback(async (username: string): Promise<boolean> => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) return false;
    try {
      const res = await fetch(`/api/user/auth?check=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        return !!data.available;
      }
      return true;
    } catch {
      return true;
    }
  }, []);

  // Register in Cloud Redis
  const register = useCallback(async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) {
      return { success: false, message: 'User ID must be at least 3 characters' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters' };
    }

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REGISTER', username: trimmed, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to create account' };
      }

      const profile: UserProfile = {
        username: data.username || trimmed,
        avatarColor: getAvatarColor(data.username || trimmed),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      await syncUsersList();
      return { success: true };
    } catch (e) {
      console.error('Registration failed', e);
      return { success: false, message: 'Failed to connect to cloud database' };
    }
  }, [syncUsersList]);

  // Login via Cloud Redis
  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter your User ID' };
    }

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOGIN', username: trimmed, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to login' };
      }

      const profile: UserProfile = {
        username: data.username || trimmed,
        avatarColor: getAvatarColor(data.username || trimmed),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true };
    } catch (e) {
      console.error('Login failed', e);
      return { success: false, message: 'Failed to connect to cloud database' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    setCurrentUser(null);
  }, []);

  const deleteAccount = useCallback(async (username: string) => {
    try {
      await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', username }),
      });

      if (currentUser?.username.toLowerCase() === username.toLowerCase()) {
        logout();
      }
      await syncUsersList();
    } catch (e) {
      console.error('Failed to delete account', e);
    }
  }, [currentUser, logout, syncUsersList]);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      usersList, 
      register, 
      login, 
      logout, 
      deleteAccount,
      isUsernameAvailable 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
