import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

type User = {
  id: number;
  username: string;
  role: 'Admin' | 'Staff';
};

type AuthContextType = {
  user: User | null;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'user-auth-session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const loadSession = async () => {
      try {
        const session = await SecureStore.getItemAsync(AUTH_KEY);
        if (session) {
          setUser(JSON.parse(session));
        }
      } catch (e) {
        console.error('Failed to load auth session', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (userData: User) => {
    setUser(userData);
    try {
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(userData));
    } catch (e) {
      console.error('Failed to save auth session', e);
    }
  };

  const logout = async () => {
    setUser(null);
    try {
      await SecureStore.deleteItemAsync(AUTH_KEY);
    } catch (e) {
      console.error('Failed to clear auth session', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
