'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  username: string;
  avatarColor: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: string[];
  login: (username: string, password?: string) => boolean;
  logout: () => void;
  deleteAccount: (username: string) => void;
}

const STORAGE_KEY_AUTH_USER = 'first_trade_current_user';
const STORAGE_KEY_USERS_REGISTRY = 'first_trade_users_registry';

// Deterministic bright pleasant colors for user avatars
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
  login: () => false,
  logout: () => {},
  deleteAccount: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load active user and registered accounts on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_AUTH_USER);
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);

      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};
      const usernames = Object.keys(registry);
      setUsersList(usernames);

      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.username) {
          setCurrentUser({
            username: parsed.username,
            avatarColor: getAvatarColor(parsed.username)
          });
        }
      } else if (usernames.length > 0) {
        // Default to the first registered account if present
        setCurrentUser({
          username: usernames[0],
          avatarColor: getAvatarColor(usernames[0])
        });
      } else {
        // If no user exists yet, auto-create a default 'Trader 1' profile so the user can immediately trade
        const defaultName = 'Trader 1';
        registry[defaultName] = '';
        localStorage.setItem(STORAGE_KEY_USERS_REGISTRY, JSON.stringify(registry));
        const prof = { username: defaultName, avatarColor: getAvatarColor(defaultName) };
        localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(prof));
        setCurrentUser(prof);
        setUsersList([defaultName]);
      }
    } catch (e) {
      console.error('Failed to load auth info', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const login = useCallback((username: string, password = ''): boolean => {
    const trimmed = username.trim();
    if (!trimmed) return false;

    try {
      const registryRaw = localStorage.getItem(STORAGE_KEY_USERS_REGISTRY);
      const registry: Record<string, string> = registryRaw ? JSON.parse(registryRaw) : {};

      if (registry[trimmed] !== undefined) {
        // User exists: verify password if password was set
        if (registry[trimmed] && registry[trimmed] !== password) {
          return false; // Wrong password
        }
      } else {
        // Register new user account
        registry[trimmed] = password;
        localStorage.setItem(STORAGE_KEY_USERS_REGISTRY, JSON.stringify(registry));
        setUsersList(Object.keys(registry));
      }

      const profile: UserProfile = {
        username: trimmed,
        avatarColor: getAvatarColor(trimmed),
      };

      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(profile));
      setCurrentUser(profile);
      return true;
    } catch (e) {
      console.error('Failed to login', e);
      return false;
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
      delete registry[username];
      localStorage.setItem(STORAGE_KEY_USERS_REGISTRY, JSON.stringify(registry));
      setUsersList(Object.keys(registry));

      // Remove trade data for this user
      localStorage.removeItem(`first_trade_${username}_balance`);
      localStorage.removeItem(`first_trade_${username}_positions`);
      localStorage.removeItem(`first_trade_${username}_orders`);

      if (currentUser?.username === username) {
        const remaining = Object.keys(registry);
        if (remaining.length > 0) {
          login(remaining[0]);
        } else {
          logout();
        }
      }
    } catch (e) {
      console.error('Failed to delete account', e);
    }
  }, [currentUser, login, logout]);

  return (
    <AuthContext.Provider value={{ currentUser, usersList, login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
