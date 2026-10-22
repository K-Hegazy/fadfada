import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest, getToken, setToken, removeToken } from '../services/api';
import { socketService } from '../services/socket';
import { 
  firebaseRegisterUser,
  firebaseLoginUser,
  firebaseLogoutUser,
  syncUserToFirestore,
  firebaseSignInAnonymous, 
  firebaseSignInWithGoogle
} from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: any) => Promise<any>;
  guestLogin: (nickname: string, gender: string, country?: string, isManualCountry?: boolean, termsAgreed?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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
      // Sync to Firestore in background
      syncUserToFirestore(res.user).catch(() => {});
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

  /**
   * 2. Login User:
   * Updates document in "users" collection:
   *  - isOnline = true
   *  - lastSeen = current date/time
   */
  const login = async (username: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(res.token);
    setUser(res.user);
    socketService.connect();

    // Firebase Firestore Update: isOnline = true, lastSeen = now
    const emailToUse = res.user.email || `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@fadfada.app`;
    firebaseLoginUser(emailToUse, password, res.user.id).catch((err) => {
      console.warn('[Firebase] Login sync notice:', err);
    });
  };

  /**
   * 1. Register User:
   * Adds new document in "users" collection with id = uid:
   *  - email
   *  - role = "basic"
   *  - balance = 0
   *  - isOnline = true
   *  - lastSeen = registration date/time
   */
  const register = async (data: any) => {
    const res = await apiRequest<{ token?: string; user?: User; requireEmailVerification?: boolean; message?: string; email?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    const emailToUse = data.email || `${data.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@fadfada.app`;
    const targetUid = res.user?.id || ('usr_' + Date.now());

    // Firebase Firestore Document Creation
    firebaseRegisterUser(emailToUse, data.password, targetUid).catch((err) => {
      console.warn('[Firebase] Register sync notice:', err);
    });

    if (res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      socketService.connect();
    }
    return res;
  };

  const guestLogin = async (nickname: string, gender: string, country?: string, isManualCountry?: boolean, termsAgreed: boolean = true) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ nickname, gender, country, isManualCountry, termsAgreed })
    });
    setToken(res.token);
    setUser(res.user);
    socketService.connect();

    // Firebase Anonymous Auth & Firestore Save
    firebaseSignInAnonymous().then(fbUser => {
      syncUserToFirestore(res.user, fbUser?.uid).catch(() => {});
    }).catch(() => {});
  };

  const loginWithGoogle = async () => {
    const googleUser = await firebaseSignInWithGoogle();
    if (!googleUser) {
      throw new Error('تم إلغاء تسجيل الدخول عبر Google');
    }

    const res = await apiRequest<{ token: string; user: User }>('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({
        email: googleUser.email,
        username: googleUser.displayName,
        authUid: googleUser.uid
      })
    });

    setToken(res.token);
    setUser(res.user);
    socketService.connect();

    // Update in Firestore
    firebaseLoginUser(googleUser.email, '', res.user.id).catch(() => {});
  };

  /**
   * 3. Logout User:
   * Updates document in "users" collection:
   *  - isOnline = false
   *  - lastSeen = logout date/time
   */
  const logout = async () => {
    const currentUserId = user?.id;
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {}

    // Firebase Firestore Update: isOnline = false, lastSeen = now & signOut
    if (currentUserId) {
      await firebaseLogoutUser(currentUserId).catch(() => {});
    } else {
      await firebaseLogoutUser().catch(() => {});
    }

    socketService.disconnect();
    removeToken();
    setUser(null);
  };

  const updateCoins = (amount: number) => {
    if (user) {
      const updated = { ...user, coins: user.coins + amount };
      setUser(updated);
      syncUserToFirestore(updated).catch(() => {});
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
        loginWithGoogle,
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
