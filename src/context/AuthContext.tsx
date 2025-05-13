"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Application credentials - strengthened
const MOCK_USERNAME = 'quantumadmin';
const MOCK_PASSWORD = 'Qu4ntumV3ill3T3ch2025!';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading until check is done
  const router = useRouter();

  useEffect(() => {
    // Check for auth status on initial load (e.g., from localStorage or a token)
    const checkAuthStatus = () => {
       try {
         const storedAuth = localStorage.getItem('isAuthenticated');
         if (storedAuth === 'true') {
           setIsAuthenticated(true);
         } else {
           setIsAuthenticated(false);
         }
       } catch (error) {
            console.error("Could not access localStorage:", error);
            // Handle environments where localStorage is not available
            setIsAuthenticated(false);
       } finally {
            setIsLoading(false); // Finished checking
       }
    };
    checkAuthStatus();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    // Simulate API call for authentication
    await new Promise(resolve => setTimeout(resolve, 500));

    if (username === MOCK_USERNAME && password === MOCK_PASSWORD) {
      try {
        localStorage.setItem('isAuthenticated', 'true');
      } catch (error) {
        console.error("Could not set auth status in localStorage:", error);
      }

      // Set authenticated state and stop loading
      setIsAuthenticated(true);
      setIsLoading(false);

      // Redirect to home page
      router.push('/');
    } else {
      try {
        localStorage.removeItem('isAuthenticated');
      } catch (error) {
        console.error("Could not remove auth status from localStorage:", error);
      }

      setIsAuthenticated(false);
      setIsLoading(false);
      throw new Error('Invalid username or password');
    }
  };

  const logout = () => {
    setIsLoading(true);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('isAuthenticated');
    } catch (error) {
      console.error("Could not remove auth status from localStorage during logout:", error);
    }

    // Stop loading
    setIsLoading(false);

    // Redirect to login page
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
