import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken, setAuthToken, clearAuthToken, apiRequest } from '../services/api';

export type UserRole = 'ADMIN' | 'LAB_INSTRUCTOR' | 'TECHNICIAN' | 'HOD' | 'PRINCIPAL';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  department_id?: number;
  assigned_labs: number[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  isLoggedOut: boolean;
  resetLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(false);

  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          const profile = await apiRequest<User>('/auth/me');
          setUser(profile);
          setToken(storedToken);
        } catch {
          clearAuthToken();
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const login = (newToken: string, userData: User) => {
    setAuthToken(newToken);
    setToken(newToken);
    setUser(userData);
    setIsLoggedOut(false);
  };

  const logout = () => {
    clearAuthToken();
    setToken(null);
    setUser(null);
    setIsLoggedOut(true);
  };

  const resetLogout = () => {
    setIsLoggedOut(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isLoggedOut, resetLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
