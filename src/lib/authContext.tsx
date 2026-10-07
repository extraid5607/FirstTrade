'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  username: string;
  avatarColor: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: string[];
  register: (username: string, password: string) => { success: boolean; message?: string };
  login: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
  deleteAccount: (username: string) => void;
  isUsernameAvailable: (username: string) => boolean;
}

const STORAGE_KEY_AUTH_USER = 'first_trade_current_user';
const STORAGE_KEY_USERS_REGISTRY = 'first_trade_users_registry';

// Deterministic pleasant gradient colors for user avatars
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
  register: () => ({ success: false }),
  login: () => ({ success: false }),
  logout: () => {},
  deleteAccount: () => {},
  isUsernameAvailable: () => true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_AUTH_USER);
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);

      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};
      const usernames = Object.keys(registry);
      setUsersList(usernames);

      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.username && registry[parsed.username] !== undefined) {
          setCurrentUser({
            username: parsed.username,
            avatarColor: getAvatarColor(parsed.username)
          });
        } else {
          // Cleared or deleted
          localStorage.removeItem(STORAGE_KEY_AUTH_USER);
          setCurrentUser(null);
        }
      }
    } catch (e) {
      console.error('Failed to load auth info', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const isUsernameAvailable = useCallback((username: string): boolean => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return false;
    try {
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);
      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};
      const existing = Object.keys(registry).map(u => u.toLowerCase());
      return !existing.includes(trimmed);
    } catch {
      return true;
    }
  }, []);

  const register = useCallback((username: string, password: string): { success: boolean; message?: string } => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter a valid User ID' };
    }
    if (trimmed.length < 3) {
      return { success: false, message: 'User ID must be at least 3 characters' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters' };
    }

    try {
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);
      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};

      // Check if User ID is already taken (case-insensitive check)
      const existingKeys = Object.keys(registry);
      const isTaken = existingKeys.some(k => k.toLowerCase() === trimmed.toLowerCase());
      if (isTaken) {
        return { success: false, message: `User ID '${trimmed}' is already taken. Please choose another.` };
      }

      // Store in registry
      registry[trimmed] = password;
      localStorage.setItem(STORAGE_KEY_USERS_REGISTRY, JSON.stringify(registry));
      setUsersList(Object.keys(registry));

      const profile: UserProfile = {
        username: trimmed,
        avatarColor: getAvatarColor(trimmed),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true };
    } catch (e) {
      console.error('Registration failed', e);
      return { success: false, message: 'Failed to save account' };
    }
  }, []);

  const login = useCallback((username: string, password: string): { success: boolean; message?: string } => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter your User ID' };
    }

    try {
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);
      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};

      // Find exact or case-insensitive match
      const matchedKey = Object.keys(registry).find(k => k.toLowerCase() === trimmed.toLowerCase());

      if (!matchedKey) {
        return { success: false, message: `User ID '${trimmed}' not found. Please create an account first.` };
      }

      if (registry[matchedKey] !== password) {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }

      const profile: UserProfile = {
        username: matchedKey,
        avatarColor: getAvatarColor(matchedKey),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true };
    } catch (e) {
      console.error('Login failed', e);
      return { success: false, message: 'Failed to login' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    setCurrentUser(null);
  }, []);

  const deleteAccount = useCallback((username: string) => {
    try {
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);
      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};
      
      const matchedKey = Object.keys(registry).find(k => k.toLowerCase() === username.toLowerCase());
      if (matchedKey) {
        delete registry[matchedKey];
        localStorage.setItem(STORAGE_KEY_USERS_REGISTRY, JSON.stringify(registry));
        setUsersList(Object.keys(registry));

        // Remove trade data for this user
        localStorage.removeItem(`first_trade_${matchedKey}_balance`);
        localStorage.removeItem(`first_trade_${matchedKey}_positions`);
        localStorage.removeItem(`first_trade_${matchedKey}_orders`);

        if (currentUser?.username.toLowerCase() === matchedKey.toLowerCase()) {
          logout();
        }
      }
    } catch (e) {
      console.error('Failed to delete account', e);
    }
  }, [currentUser, logout]);

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
