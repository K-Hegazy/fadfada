import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '../services/auth';
import {
  completeEmailVerification,
  resendVerificationEmail,
  resetPassword,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthChanges,
  upgradeGuestToMember,
} from '../services/auth';
import { ensureOfficialRooms } from '../services/community';
import {
  ensureStaffDefaults,
  markAllNotificationsRead,
  subscribeToMarriages,
  subscribeToNotifications,
  subscribeToRelationships,
  subscribeToShoutouts,
  subscribeToSiteSettings,
  subscribeToStoreItems,
} from '../services/economy';
import {
  getPeerIdFromConversation,
  getUnreadCountForUser,
  subscribeToConversations,
} from '../services/messaging';
import {
  isExpiredOrOfflineGuest,
  isUserPresenceOnline,
  startRealtimePresence,
  type PresenceSessionHandle,
} from '../services/presence';
import {
  detectUserCountry,
  getCachedDetectedCountry,
  getLastSyncedUserCountry,
  markUserCountrySynced,
} from '../services/geolocation';
import {
  deleteGuestAccount,
  ensureUserProfile,
  recordProfileVisit,
  subscribeToPublicUsers,
  subscribeToUserProfile,
  syncUserCountry,
} from '../services/profiles';
import type {
  ActiveNavSection,
  AppNotification,
  Conversation,
  GuestEntryInput,
  Marriage,
  PresenceConnectionState,
  Relationship,
  Shoutout,
  SiteSettings,
  StoreItem,
  ThemeMode,
  UserProfile,
} from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';
import { playNotificationChime } from '../utils/media';
import { DEFAULT_SITE_SETTINGS, DEFAULT_STORE_ITEMS, isKnownCountry } from '../utils/progression';

interface AppContextValue {
  authUser: AuthUser | null;
  authReady: boolean;
  profile: UserProfile | null;
  users: UserProfile[];
  usersById: Record<string, UserProfile>;
  conversations: Conversation[];
  storeItems: StoreItem[];
  siteSettings: SiteSettings;
  shoutouts: Shoutout[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  relationships: Relationship[];
  marriages: Marriage[];
  presenceState: PresenceConnectionState;
  activeSection: ActiveNavSection;
  setActiveSection: (section: ActiveNavSection) => void;
  activePeerId: string | null;
  openChatWith: (peerUid: string) => void;
  closeActiveChat: () => void;
  inspectedProfileUid: string | null;
  openProfileModal: (uid: string) => void;
  closeProfileModal: () => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  markNotificationsRead: () => Promise<void>;
  toastNotification: AppNotification | null;
  dismissToast: () => void;
  totalUnreadCount: number;
  isPeerOnline: (user: UserProfile, forStaffOverride?: boolean) => boolean;
  getPeerLastSeenMillis: (user: UserProfile) => number;
  isStaff: boolean;
  isOwner: boolean;
  isGuest: boolean;
  theme: ThemeMode;
  toggleTheme: () => void;
  runtimeError: Error | null;
  clearRuntimeError: () => void;
  countryDetectionFailed: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
    acceptedTerms?: boolean
  ) => Promise<void>;
  loginAsGuest: (guestProfile: GuestEntryInput) => Promise<void>;
  upgradeGuest: (email: string, password: string, displayName?: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  sendVerifyEmail: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rawUsers, setRawUsers] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>(DEFAULT_STORE_ITEMS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    ...DEFAULT_SITE_SETTINGS,
    updatedAt: null,
  });
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [marriages, setMarriages] = useState<Marriage[]>([]);
  const [presenceState, setPresenceState] = useState<PresenceConnectionState>('connecting');
  const [presenceClockMs, setPresenceClockMs] = useState(() => Date.now());
  const [countryDetectionFailed, setCountryDetectionFailed] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveNavSection>('wall');
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [inspectedProfileUid, setInspectedProfileUid] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('fadfada_theme') === 'dark' ? 'dark' : 'light';
  });

  const presenceHandleRef = useRef<PresenceSessionHandle | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const firstNotifBatchRef = useRef(true);
  const seededForUidRef = useRef<string | null>(null);
  const countrySyncInFlightUidRef = useRef<string | null>(null);
  const countrySyncCompletedForKeyRef = useRef<string | null>(null);
  const [geoDetectionTick, setGeoDetectionTick] = useState(0);
  const soundEnabledRef = useRef(true);
  const pendingEnsureOptionsRef = useRef<{
    guestProfile?: GuestEntryInput;
    acceptedTerms?: boolean;
  } | null>(null);

  // Detect user country via HTTPS IP geolocation once on first visit (cached, no GPS, no IP stored)
  useEffect(() => {
    let cancelled = false;
    const runDetect = () => {
      void detectUserCountry().then((detected) => {
        if (cancelled) return;
        setCountryDetectionFailed(detected === null);
        if (detected) {
          setGeoDetectionTick((n) => n + 1);
        }
      });
    };
    runDetect();

    const handleOnline = () => {
      if (!getCachedDetectedCountry()) {
        runDetect();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    soundEnabledRef.current = profile?.privacy?.soundNotifications !== false;
  }, [profile?.privacy?.soundNotifications]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    window.localStorage.setItem('fadfada_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verify') === '1') {
      const userId = params.get('userId');
      const secret = params.get('secret');
      if (userId && secret) {
        void completeEmailVerification(userId, secret)
          .catch((error) => {
            if (error instanceof Error) setRuntimeError(error);
          })
          .finally(() => {
            window.history.replaceState({}, '', window.location.pathname);
          });
      }
    }

    const unsubscribe = subscribeToAuthChanges((user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setRawUsers([]);
        setConversations([]);
        setNotifications([]);
        setRelationships([]);
        setMarriages([]);
        setPresenceState('offline');
        setActivePeerId(null);
        setInspectedProfileUid(null);
        setActiveSection('wall');
        seenNotifIdsRef.current.clear();
        firstNotifBatchRef.current = true;
        countrySyncInFlightUidRef.current = null;
        countrySyncCompletedForKeyRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  // Client-only clock tick (no backend writes) to expire stale lastSeen entries in UI
  useEffect(() => {
    if (!authUser) return;
    const timer = window.setInterval(() => {
      setPresenceClockMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [authUser]);

  const isOwner = useMemo(() => profile?.role === 'owner', [profile]);

  const isStaff = useMemo(() => {
    if (!profile) {
      return isOwner;
    }
    return isOwner || profile.role === 'moderator';
  }, [profile, isOwner]);

  useEffect(() => {
    if (!authReady || !authUser) {
      presenceHandleRef.current?.dispose();
      presenceHandleRef.current = null;
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const setupUserSession = async () => {
      try {
        const pendingOpts = pendingEnsureOptionsRef.current ?? undefined;
        pendingEnsureOptionsRef.current = null;
        const detectedCountry =
          getCachedDetectedCountry() ?? (await detectUserCountry().catch(() => null));
        if (!cancelled) {
          setCountryDetectionFailed(detectedCountry === null);
        }
        const ensuredProfile = await ensureUserProfile(authUser, {
          ...pendingOpts,
          ...(detectedCountry ? { detectedCountry } : {}),
        });
        if (!cancelled && ensuredProfile) {
          setProfile((prev) => prev ?? ensuredProfile);
        }
      } catch (error) {
        if (!cancelled && error instanceof Error) setRuntimeError(error);
      }

      if (cancelled) return;

      const handle = startRealtimePresence(authUser.uid, (state) => {
        if (!cancelled) setPresenceState(state);
      });
      presenceHandleRef.current = handle;

      unsubs.push(
        subscribeToUserProfile(
          authUser.uid,
          (userProfile) => {
            if (cancelled) return;
            setProfile(userProfile);
            if (
              userProfile &&
              (userProfile.role === 'owner' || userProfile.role === 'moderator') &&
              seededForUidRef.current !== userProfile.uid
            ) {
              seededForUidRef.current = userProfile.uid;
              void ensureStaffDefaults();
              void ensureOfficialRooms(userProfile.uid, userProfile.displayName);
            }
          },
          (err) => {
            if (!cancelled) setRuntimeError(err);
          }
        )
      );

      unsubs.push(
        subscribeToConversations(
          authUser.uid,
          (convList) => {
            if (!cancelled) setConversations(convList);
          },
          (err) => {
            if (!cancelled) setRuntimeError(err);
          }
        )
      );

      unsubs.push(subscribeToSiteSettings((s) => !cancelled && setSiteSettings(s)));
      unsubs.push(subscribeToStoreItems((items) => !cancelled && setStoreItems(items)));
      unsubs.push(subscribeToShoutouts((list) => !cancelled && setShoutouts(list)));
      unsubs.push(subscribeToRelationships(authUser.uid, (list) => !cancelled && setRelationships(list)));
      unsubs.push(subscribeToMarriages(authUser.uid, (list) => !cancelled && setMarriages(list)));

      unsubs.push(
        subscribeToNotifications(authUser.uid, (list) => {
          if (cancelled) return;
          setNotifications(list);

          if (firstNotifBatchRef.current) {
            for (const n of list) seenNotifIdsRef.current.add(n.id);
            firstNotifBatchRef.current = false;
            return;
          }

          const newest = list.find((n) => !n.isRead && !seenNotifIdsRef.current.has(n.id));
          for (const n of list) seenNotifIdsRef.current.add(n.id);

          if (newest) {
            setToastNotification(newest);
            if (soundEnabledRef.current) {
              playNotificationChime();
            }
          }
        })
      );
    };

    void setupUserSession();

    return () => {
      cancelled = true;
      presenceHandleRef.current?.dispose();
      presenceHandleRef.current = null;
      for (const unsub of unsubs) unsub();
    };
  }, [authReady, authUser]);

  const profileUid = profile?.uid ?? '';
  const profileCountry = profile?.country ?? '';
  const profileCountryCode = profile?.countryCode ?? '';

  // Link detected country to the logged-in user profile (and update on country change without repeated requests)
  useEffect(() => {
    const uid = authUser?.uid;
    if (!authReady || !uid || !profileUid || profileUid !== uid) return;
    if (countrySyncInFlightUidRef.current === uid) return;

    let cancelled = false;
    countrySyncInFlightUidRef.current = uid;

    const syncDetectedCountry = async () => {
      try {
        const detected =
          getCachedDetectedCountry() ?? (await detectUserCountry().catch(() => null));
        if (cancelled) return;
        setCountryDetectionFailed(detected === null);
        if (!detected) return;

        const syncKey = `${uid}:${detected.countryCode}:${detected.country}`;
        const currentCode = profileCountryCode.trim().toUpperCase();
        const currentCountry = profileCountry.trim();
        const profileHasKnownCountry = isKnownCountry(currentCountry);

        if (countrySyncCompletedForKeyRef.current === syncKey && profileHasKnownCountry) {
          return;
        }

        const lastSynced = getLastSyncedUserCountry(uid);
        const alreadySyncedThisDetected = Boolean(
          lastSynced &&
            lastSynced.countryCode === detected.countryCode &&
            lastSynced.country === detected.country
        );

        const exactProfileMatch =
          currentCode === detected.countryCode && currentCountry === detected.country;

        if (exactProfileMatch || (profileHasKnownCountry && alreadySyncedThisDetected)) {
          if (!alreadySyncedThisDetected) {
            markUserCountrySynced(uid, detected);
          }
          countrySyncCompletedForKeyRef.current = syncKey;
          return;
        }

        const updatedProfile = await syncUserCountry(detected);
        markUserCountrySynced(uid, detected);
        countrySyncCompletedForKeyRef.current = syncKey;
        if (!cancelled && updatedProfile) {
          setProfile((prev) => (prev && prev.uid === updatedProfile.uid ? updatedProfile : prev));
          setRawUsers((prev) =>
            prev.map((u) => (u.uid === updatedProfile.uid ? updatedProfile : u))
          );
        }
      } catch {
        // Non-blocking: user can still pick country manually in ProfilePanel
      } finally {
        if (countrySyncInFlightUidRef.current === uid) {
          countrySyncInFlightUidRef.current = null;
        }
      }
    };

    void syncDetectedCountry();
    return () => {
      cancelled = true;
    };
  }, [authReady, authUser?.uid, profileUid, profileCountry, profileCountryCode, geoDetectionTick]);

  useEffect(() => {
    if (!authReady || !authUser?.uid) return;
    let cancelled = false;
    const unsub = subscribeToPublicUsers(
      (publicUsers) => {
        if (!cancelled) {
          setRawUsers(publicUsers);
          setPresenceClockMs(Date.now());
        }
      },
      (err) => {
        if (!cancelled) setRuntimeError(err);
      },
      isStaff
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authReady, authUser?.uid, isStaff]);

  const users = useMemo(
    () =>
      rawUsers.filter(
        (u) => u.uid === authUser?.uid || !isExpiredOrOfflineGuest(u, presenceClockMs)
      ),
    [rawUsers, authUser?.uid, presenceClockMs]
  );

  const usersById = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    for (const u of users) map[u.uid] = u;
    return map;
  }, [users]);

  const isPeerOnline = useCallback(
    (user: UserProfile, forStaffOverride = false): boolean => {
      if (!forStaffOverride && user.uid !== authUser?.uid) {
        if (user.ghostMode || user.privacy?.showOnline === false) {
          return false;
        }
      }
      return isUserPresenceOnline(user, presenceClockMs);
    },
    [authUser, presenceClockMs]
  );

  const getPeerLastSeenMillis = useCallback(
    (user: UserProfile): number => {
      if (user.uid !== authUser?.uid && user.hideLastSeen) {
        return 0;
      }
      return timestampToMillis(user.lastSeen);
    },
    [authUser]
  );

  const totalUnreadCount = useMemo(() => {
    if (!authUser) return 0;
    return conversations.reduce((sum, conv) => {
      if ((conv.archivedBy ?? []).includes(authUser.uid)) return sum;
      const peerId = getPeerIdFromConversation(conv, authUser.uid);
      if (!peerId) return sum;
      return sum + getUnreadCountForUser(conv, authUser.uid);
    }, 0);
  }, [authUser, conversations]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const openChatWith = useCallback((peerUid: string) => {
    setActivePeerId(peerUid);
    setActiveSection('chats');
    setInspectedProfileUid(null);
  }, []);

  const closeActiveChat = useCallback(() => {
    setActivePeerId(null);
  }, []);

  const openProfileModal = useCallback(
    (uid: string) => {
      setInspectedProfileUid(uid);
      if (profile && uid !== profile.uid) {
        void recordProfileVisit(uid, profile);
      }
    },
    [profile]
  );

  const closeProfileModal = useCallback(() => {
    setInspectedProfileUid(null);
  }, []);

  const markNotificationsRead = useCallback(async () => {
    await markAllNotificationsRead(notifications);
  }, [notifications]);

  const dismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  const clearRuntimeError = useCallback(() => {
    setRuntimeError(null);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const registerWithEmail = useCallback(
    async (email: string, password: string, displayName: string, acceptedTerms = true) => {
      pendingEnsureOptionsRef.current = { acceptedTerms };
      await signUpWithEmail(email, password, displayName);
    },
    []
  );

  const loginAsGuest = useCallback(async (guestProfile: GuestEntryInput) => {
    pendingEnsureOptionsRef.current = { guestProfile };
    await signInAsGuest();
  }, []);

  const upgradeGuest = useCallback(async (email: string, password: string, displayName?: string) => {
    const upgraded = await upgradeGuestToMember(email, password, displayName);
    await ensureUserProfile(upgraded, { acceptedTerms: true });
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    await resetPassword(email);
  }, []);

  const sendVerifyEmail = useCallback(async () => {
    await resendVerificationEmail();
  }, []);

  const logout = useCallback(async () => {
    const handle = presenceHandleRef.current;
    const isGuestSession = Boolean(
      profile ? profile.role === 'guest' || profile.isAnonymous : authUser?.isAnonymous
    );
    await signOutUser(async () => {
      if (isGuestSession) {
        try {
          await deleteGuestAccount();
          return;
        } catch {
          // Fallback to marking offline if cleanup function fails temporarily
        }
      }
      if (handle) {
        await handle.setOfflineNow();
      }
    });
  }, [profile, authUser]);

  const value: AppContextValue = {
    authUser,
    authReady,
    profile,
    users,
    usersById,
    conversations,
    storeItems,
    siteSettings,
    shoutouts,
    notifications,
    unreadNotificationsCount,
    relationships,
    marriages,
    presenceState,
    activeSection,
    setActiveSection,
    activePeerId,
    openChatWith,
    closeActiveChat,
    inspectedProfileUid,
    openProfileModal,
    closeProfileModal,
    notificationsOpen,
    setNotificationsOpen,
    markNotificationsRead,
    toastNotification,
    dismissToast,
    totalUnreadCount,
    isPeerOnline,
    getPeerLastSeenMillis,
    isStaff,
    isOwner,
    isGuest: Boolean(profile ? profile.role === 'guest' || profile.isAnonymous : authUser?.isAnonymous),
    theme,
    toggleTheme,
    runtimeError,
    clearRuntimeError,
    countryDetectionFailed,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    loginAsGuest,
    upgradeGuest,
    sendResetEmail,
    sendVerifyEmail,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
