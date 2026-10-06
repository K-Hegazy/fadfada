import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest, getToken, setToken, removeToken } from '../services/api';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  guestLogin: (nickname: string, gender: string, country?: string, isManualCountry?: boolean, termsAgreed?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateCoins: (amount: number) => void;
  setUnreadMessagesCount: (count: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{ user: User }>('/auth/me');
      setUser(res.user);
      socketService.connect();
    } catch (e) {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Real-time unread messages sync over WebSocket
  useEffect(() => {
    if (!user) return;

    const unsubUnread = socketService.on('unread_count:update', (data: any) => {
      if (typeof data?.unreadMessages === 'number') {
        setUser(prev => prev ? { ...prev, unreadMessages: data.unreadMessages } : null);
      }
    });

    const unsubNewMsg = socketService.on('new_private_message', (data: any) => {
      if (typeof data?.unreadCount === 'number') {
        setUser(prev => prev ? { ...prev, unreadMessages: data.unreadCount } : null);
      }
    });

    return () => {
      unsubUnread();
      unsubNewMsg();
    };
  }, [user?.id]);

  const setUnreadMessagesCount = (count: number) => {
    setUser(prev => prev ? { ...prev, unreadMessages: Math.max(0, count) } : null);
  };

  const login = async (username: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(res.token);
    setUser(res.user);
    socketService.connect();
  };

  const register = async (data: any) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setToken(res.token);
    setUser(res.user);
    socketService.connect();
  };

  const guestLogin = async (nickname: string, gender: string, country?: string, isManualCountry?: boolean, termsAgreed: boolean = true) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ nickname, gender, country, isManualCountry, termsAgreed })
    });
    setToken(res.token);
    setUser(res.user);
    socketService.connect();
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {}
    socketService.disconnect();
    removeToken();
    setUser(null);
  };

  const updateCoins = (amount: number) => {
    if (user) {
      setUser({ ...user, coins: user.coins + amount });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        guestLogin,
        logout,
        refreshUser,
        updateCoins,
        setUnreadMessagesCount
      }}
    >
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
