import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  Settings,
  User,
  Shield,
  Lock,
  Smartphone,
  Globe2,
  Image as ImageIcon,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Bell,
  MessageSquare,
  Sliders,
  LogOut,
  Sparkles,
  Camera,
  Tag,
  Plus,
  X,
  AlertTriangle,
  Radio,
  FileCheck,
  CheckCircle2,
  Film,
  Zap,
  Volume2,
  UserX,
  Crown
} from 'lucide-react';
import { playNotificationSound, SoundType } from '../services/sound';

const ARAB_COUNTRIES = [
  'مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان',
  'العراق', 'الأردن', 'لبنان', 'سوريا', 'فلسطين', 'اليمن', 'المغرب',
  'الجزائر', 'تونس', 'ليبيا', 'السودان', 'موريتانيا', 'الصومال', 'جيبوتي', 'جزر القمر',
  'تركيا', 'ألمانيا', 'المملكة المتحدة', 'السويد', 'الولايات المتحدة', 'كندا', 'أخرى'
];

type SettingsSection =
  | 'profile'
  | 'privacy'
  | 'media'
  | 'security'
  | 'account'
  | 'notifications'
  | 'messages'
  | 'appearance'
  | 'language'
  | 'blocks';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  // --- Profile State ---
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [country, setCountry] = useState(user?.country || 'السعودية');
  const [gender, setGender] = useState<'male' | 'female'>(user?.gender || 'male');
  const [birthDate, setBirthDate] = useState((user as any)?.birthDate || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [newInterestInput, setNewInterestInput] = useState('');

  // Avatar and Cover
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatarUrl || '');
  const [coverPreview, setCoverPreview] = useState<string>((user as any)?.coverUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // --- Privacy State ---
  const [privacyMessages, setPrivacyMessages] = useState(user?.privacy?.messages || 'everyone');
  const [privacyProfile, setPrivacyProfile] = useState((user?.privacy as any)?.profileVisibility || 'everyone');
  const [privacyStories, setPrivacyStories] = useState(user?.privacy?.storyVisibility || 'everyone');
  const [privacyFriendRequests, setPrivacyFriendRequests] = useState(user?.privacy?.friendRequests || 'everyone');
  const [privacyOnlineStatus, setPrivacyOnlineStatus] = useState((user?.privacy as any)?.onlineStatus || 'everyone');
  const [privacyLastSeen, setPrivacyLastSeen] = useState((user?.privacy as any)?.lastSeen || 'everyone');

  // --- Media State ---
  const [autoDownloadImages, setAutoDownloadImages] = useState(true);
  const [autoDownloadVideo, setAutoDownloadVideo] = useState(false);
  const [mediaQuality, setMediaQuality] = useState<'high' | 'standard' | 'saver'>('high');
  const [autoplayVideo, setAutoplayVideo] = useState(true);
  const [defaultViewOnce, setDefaultViewOnce] = useState(false);

  // --- Security State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  // --- Blocked Users State ---
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<any[]>([]);
  const [mutesLoading, setMutesLoading] = useState(false);
  const [blocksTab, setBlocksTab] = useState<'blocks' | 'mutes'>('blocks');

  // --- Notifications State ---
  const [notifSound, setNotifSound] = useState(true);
  const [selectedSound, setSelectedSound] = useState<SoundType>('chime');
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifFriendReq, setNotifFriendReq] = useState(true);
  const [notifRooms, setNotifRooms] = useState(true);

  const handleSoundChange = async (sound: SoundType) => {
    setSelectedSound(sound);
    localStorage.setItem('fadfada_sound', sound);
    playNotificationSound(sound, true);
    try {
      await apiRequest('/users/me/settings/sound', {
        method: 'PUT',
        body: JSON.stringify({
          notificationSound: sound,
          soundEnabled: notifSound
        })
      });
      refreshUser();
    } catch (e) {
      console.error('Failed to save sound settings:', e);
    }
  };

  const handleToggleSound = async (enabled: boolean) => {
    setNotifSound(enabled);
    localStorage.setItem('fadfada_sound_enabled', enabled ? 'true' : 'false');
    try {
      await apiRequest('/users/me/settings/sound', {
        method: 'PUT',
        body: JSON.stringify({
          notificationSound: selectedSound,
          soundEnabled: enabled
        })
      });
      refreshUser();
    } catch (e) {
      console.error('Failed to toggle sound:', e);
    }
  };

  // --- Account deletion ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Global save state
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [detectingCountry, setDetectingCountry] = useState(false);
  const [detectToast, setDetectToast] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || '');
      setBio(user.bio || '');
      setCountry(user.country || 'السعودية');
      setGender(user.gender || 'male');
      setInterests(user.interests || []);
      setAvatarPreview(user.avatarUrl || '');
      setCoverPreview((user as any).coverUrl || '');
      if (user.privacy) {
        setPrivacyMessages(user.privacy.messages || 'everyone');
        setPrivacyStories(user.privacy.storyVisibility || 'everyone');
        setPrivacyFriendRequests(user.privacy.friendRequests || 'everyone');
      }
      if (user.notificationSound) {
        setSelectedSound(user.notificationSound as SoundType);
      }
      if (user.soundEnabled !== undefined) {
        setNotifSound(user.soundEnabled);
      }
    }
  }, [user]);

  // Load active sessions when security tab selected
  useEffect(() => {
    if (activeSection === 'security') {
      fetchSessions();
    } else if (activeSection === 'blocks') {
      fetchBlockedUsers();
      fetchMutedUsers();
    }
  }, [activeSection]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await apiRequest<{ sessions: any[] }>('/users/sessions');
      setSessions(res.sessions || []);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    setBlocksLoading(true);
    try {
      const res = await apiRequest<{ blocks: any[] }>('/blocks');
      setBlockedUsers(res.blocks || []);
    } catch (e) {
      console.error('Failed to load blocks', e);
    } finally {
      setBlocksLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    try {
      await apiRequest(`/blocks/${blockedUserId}`, { method: 'DELETE' });
      setBlockedUsers(prev => prev.filter(b => b.blockedUserId !== blockedUserId));
    } catch (e) {
      alert('فشل إلغاء الحظر');
    }
  };

  const fetchMutedUsers = async () => {
    setMutesLoading(true);
    try {
      const res = await apiRequest<{ mutes: any[] }>('/mutes');
      setMutedUsers(res.mutes || []);
    } catch (e) {
      console.error('Failed to load mutes', e);
    } finally {
      setMutesLoading(false);
    }
  };

  const handleUnmute = async (mutedUserId: string) => {
    try {
      await apiRequest(`/mutes/${mutedUserId}`, { method: 'DELETE' });
      setMutedUsers(prev => prev.filter(m => m.mutedUserId !== mutedUserId));
    } catch (e) {
      alert('فشل إلغاء الكتم');
    }
  };

  // Avatar Upload with Compression Preview
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 10 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setAvatarPreview(reader.result as string);
      setAvatarUploading(true);
      try {
        const uploadRes = await apiRequest<{ success: boolean; url: string }>('/upload', {
          method: 'POST',
          body: JSON.stringify({
            mediaBase64: reader.result,
            mimeType: file.type || 'image/jpeg'
          })
        });
        if (uploadRes.url) {
          setAvatarPreview(uploadRes.url);
        }
      } catch (err) {
        alert('تعذر رفع الصورة، تأكد من اتصال الإنترنت');
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Cover Upload
  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setCoverPreview(reader.result as string);
      setCoverUploading(true);
      try {
        const uploadRes = await apiRequest<{ success: boolean; url: string }>('/upload', {
          method: 'POST',
          body: JSON.stringify({
            mediaBase64: reader.result,
            mimeType: file.type || 'image/jpeg'
          })
        });
        if (uploadRes.url) {
          setCoverPreview(uploadRes.url);
        }
      } catch (err) {
        alert('تعذر رفع صورة الغلاف');
      } finally {
        setCoverUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Redetect Country via Network IP
  const handleRedetectCountry = async () => {
    setDetectingCountry(true);
    try {
      const res = await apiRequest<{ success: boolean; country: string; message: string }>(
        '/users/profile/redetect-country',
        { method: 'POST' }
      );
      if (res.country) {
        setCountry(res.country);
        await refreshUser();
        setDetectToast(`تم تحديد دولتك تلقائياً عبر الشبكة: ${res.country} 🌍`);
        setTimeout(() => setDetectToast(null), 3500);
      }
    } catch (e: any) {
      alert(e.message || 'فشل الكشف التلقائي عن الدولة');
    } finally {
      setDetectingCountry(false);
    }
  };

  // Add & Remove Interests
  const handleAddInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInterestInput.trim()) return;
    const tag = newInterestInput.trim().replace('#', '');
    if (!interests.includes(tag)) {
      setInterests(prev => [...prev, tag]);
    }
    setNewInterestInput('');
  };

  const handleRemoveInterest = (tag: string) => {
    setInterests(prev => prev.filter(t => t !== tag));
  };

  // Save All Settings to Backend
  const handleSaveProfileAndSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await apiRequest('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          displayName,
          bio,
          country,
          gender,
          birthDate,
          avatarUrl: avatarPreview,
          coverUrl: coverPreview,
          interests,
          privacy: {
            messages: privacyMessages,
            friendRequests: privacyFriendRequests,
            storyVisibility: privacyStories,
            profileVisibility: privacyProfile,
            onlineStatus: privacyOnlineStatus,
            lastSeen: privacyLastSeen
          },
          media: {
            autoDownloadImages,
            autoDownloadVideo,
            quality: mediaQuality,
            autoplayVideo,
            defaultViewOnce
          }
        })
      });

      if (refreshUser) await refreshUser();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'كلمة المرور الجديدة وتأكيدها غير متطابقين', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'كلمة المرور يجب أن تتكون من 6 خانات على الأقل', type: 'error' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMsg(null);

    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setPasswordMsg({ text: res.message || 'تم تحديث كلمة المرور بنجاح!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ text: err.message || 'فشل تغيير كلمة المرور، تأكد من الحالية', type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Revoke other sessions
  const handleRevokeOtherSessions = async () => {
    if (!confirm('هل أنت متأكد من رغبتك في تسجيل الخروج من كافة الأجهزة الأخرى؟')) return;
    setRevokingSessions(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/users/sessions/revoke-others', {
        method: 'POST'
      });
      alert(res.message || 'تم إنهاء الجلسات الأخرى بنجاح');
      fetchSessions();
    } catch (err) {
      alert('حدث خطأ أثناء إنهاء الجلسات');
    } finally {
      setRevokingSessions(false);
    }
  };

  // Delete account confirmation
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('يرجى كتابة كلمة المرور لتأكيد حذف الحساب نهائياً');
      return;
    }

    setDeletingAccount(true);
    setDeleteError(null);

    try {
      await apiRequest('/users/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword })
      });
      alert('تم حذف حسابك بنجاح. نتمنى لك التوفيق!');
      logout();
    } catch (err: any) {
      setDeleteError(err.message || 'فشل حذف الحساب، تأكد من كلمة المرور');
      setDeletingAccount(false);
    }
  };

  const copyReferralCode = () => {
    const code = user?.referralCode || 'FADFADA';
    navigator.clipboard.writeText(`انضم معي إلى منصة فضفضه الاجتماعية الراقية! كود الدعوة: ${code}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const SECTIONS: { id: SettingsSection; label: string; icon: any }[] = [
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    { id: 'privacy', label: 'الخصوصية', icon: Shield },
    { id: 'media', label: 'إعدادات الوسائط', icon: Film },
    { id: 'security', label: 'الأمان والجلسات', icon: Lock },
    { id: 'account', label: 'الحساب', icon: Smartphone },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'messages', label: 'الرسائل', icon: MessageSquare },
    { id: 'appearance', label: 'المظهر', icon: Sliders },
    { id: 'language', label: 'اللغة', icon: Globe2 },
    { id: 'blocks', label: 'الحظر والكتم', icon: UserX }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in" dir="rtl">
      {/* Top Banner Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-slate-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-cairo font-black text-white">
              الإعدادات والملف الشخصي
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal">
            إدارة متقدمة لحسابك، الخصوصية، الصور الشخصية، الأمان وإعدادات الوسائط.
          </p>
        </div>

        {/* Global Save Button */}
        <button
          onClick={() => handleSaveProfileAndSettings()}
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95 shrink-0"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>جاري الحفظ...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>تم الحفظ بنجاح!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>حفظ كافة التعديلات</span>
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Tabs Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl sm:rounded-3xl p-2 sm:p-3 shadow-xl overflow-x-auto no-scrollbar flex lg:flex-col gap-1.5 sm:gap-1">
          {SECTIONS.map(sec => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-auto lg:w-full px-3.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-cairo font-bold flex items-center gap-2 sm:gap-3 transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="lg:col-span-8 xl:col-span-9 bg-neutral-900/80 border border-neutral-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 space-y-6 shadow-xl">
          {/* =========================================
              1. PROFILE SECTION
             ========================================= */}
          {activeSection === 'profile' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <span>تطوير الملف الشخصي (Profile)</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  عدّل صورتك الشخصية، صورة الغلاف، النبذة، والاهتمامات لتظهر للآخرين بحضور جذاب.
                </p>
              </div>

              {/* Cover Photo Area with Live Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300 font-tajawal flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>صورة الغلاف (Cover Photo)</span>
                  </label>
                  {coverPreview && (
                    <button
                      type="button"
                      onClick={() => setCoverPreview('')}
                      className="text-xs text-rose-400 hover:text-rose-300 font-tajawal cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الغلاف</span>
                    </button>
                  )}
                </div>

                <div className="relative w-full h-36 sm:h-48 rounded-3xl overflow-hidden bg-gradient-to-r from-neutral-800 via-neutral-850 to-neutral-800 border border-neutral-700/80 flex items-center justify-center group shadow-inner">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center space-y-1 text-neutral-500">
                      <Camera className="w-8 h-8 mx-auto opacity-40" />
                      <span className="text-xs font-tajawal block">لا توجد صورة غلاف حالياً</span>
                    </div>
                  )}

                  {/* Upload overlay button */}
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="absolute bottom-3 left-3 px-3.5 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 text-white text-xs font-bold font-tajawal border border-neutral-700 backdrop-blur flex items-center gap-1.5 cursor-pointer shadow-lg transition-transform active:scale-95"
                  >
                    {coverUploading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{coverPreview ? 'تغيير صورة الغلاف' : 'رفع صورة غلاف'}</span>
                  </button>
                </div>
                <input
                  type="file"
                  ref={coverInputRef}
                  onChange={handleCoverFile}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Avatar Section with Live Preview, Upload, Change, Delete */}
              <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex flex-col sm:flex-row items-center gap-5">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-neutral-800 border-2 border-neutral-700 overflow-hidden flex items-center justify-center shadow-xl">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold font-cairo text-neutral-400">
                        {user?.username?.slice(0, 2).toUpperCase() || '👤'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer transition-transform active:scale-90"
                    title="تغيير الصورة الشخصية"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-center sm:text-right flex-1">
                  <h3 className="text-sm font-bold font-cairo text-white">الصورة الشخصية (Avatar)</h3>
                  <p className="text-xs text-neutral-400 font-tajawal">
                    يدعم رفع ومعاينة الصور بصيغ JPG, PNG, WEBP مع ضغط آمن وسريع قبل التخزين.
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-tajawal font-bold cursor-pointer transition-colors"
                    >
                      {avatarUploading ? 'جاري الرفع...' : 'رفع صورة جديدة'}
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => setAvatarPreview('')}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-tajawal cursor-pointer transition-colors"
                      >
                        حذف الصورة
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarFile}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Username & Display Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                    اسم المستخدم (الفريد)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.username || ''}
                    className="w-full px-4 py-2.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-neutral-400 text-sm font-tajawal cursor-not-allowed"
                  />
                  <span className="text-[10px] text-neutral-500 font-tajawal mt-1 block">
                    اسم الحساب ثابت للدلالة وتجنب انتحال الشخصيات.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                    الاسم الظاهر (Display Name)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="اكتب اسمك أو لقبك المفضل..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-emerald-500 outline-none font-tajawal"
                  />
                </div>
              </div>

              {/* Bio snippet */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  النبذة التعريفية (Bio)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="اكتب نبذة راقية تعبّر عن اهتماماتك وفلسفتك في الحياة..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-white text-sm focus:border-emerald-500 outline-none resize-none font-tajawal"
                />
              </div>

              {/* Country & Auto-Detection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold text-neutral-300 font-tajawal">
                    الدولة (ترتّب بها الأولوية في المتصلين)
                  </label>
                  <button
                    type="button"
                    onClick={handleRedetectCountry}
                    disabled={detectingCountry}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-tajawal cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${detectingCountry ? 'animate-spin' : ''}`} />
                    <span>{detectingCountry ? 'جاري الكشف...' : 'إعادة الكشف التلقائي عبر الشبكة 🌍'}</span>
                  </button>
                </div>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-white text-sm outline-none cursor-pointer"
                >
                  {ARAB_COUNTRIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {detectToast && (
                  <p className="text-xs text-emerald-400 font-tajawal animate-in fade-in">
                    ✓ {detectToast}
                  </p>
                )}
              </div>

              {/* Gender and Birth Date (Protected) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                    الجنس
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        gender === 'male'
                          ? 'bg-sky-600 text-white'
                          : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      ذكر 💎
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        gender === 'female'
                          ? 'bg-rose-600 text-white'
                          : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      أنثى 🌸
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                    تاريخ الميلاد (محمي ولا يظهر كاملاً للآخرين)
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-2xl bg-neutral-950 border border-neutral-800 text-white text-sm outline-none font-tajawal cursor-pointer"
                  />
                  <span className="text-[10px] text-neutral-500 font-tajawal mt-1 block">
                    يستخدم لحساب العمر والبرج فقط ولا يُعرض التاريخ الكامل حفاظاً على الخصوصية.
                  </span>
                </div>
              </div>

              {/* Interests Tags */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-300 font-tajawal">
                  الاهتمامات والهوايات
                </label>
                <form onSubmit={handleAddInterest} className="flex gap-2">
                  <input
                    type="text"
                    value={newInterestInput}
                    onChange={e => setNewInterestInput(e.target.value)}
                    placeholder="أضف اهتماماً جديداً (مثال: البرمجة، القراءة، السفر)..."
                    className="flex-1 px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs outline-none font-tajawal"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {interests.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs font-tajawal flex items-center gap-1.5"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveInterest(tag)}
                        className="text-neutral-500 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              2. PRIVACY SECTION
             ========================================= */}
          {activeSection === 'privacy' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span>إعدادات الخصوصية والحماية</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  تحكم كامل في من يستطيع مراسلتك، رؤية ملفك، وحالة اتصالك.
                </p>
              </div>

              {/* Who can message me */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                <label className="text-xs font-bold text-neutral-200 font-tajawal">
                  من يمكنه مراسلتي في الخاص؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'everyone', label: 'الجميع بلا استثناء' },
                    { id: 'friends_only', label: 'الأصدقاء فقط' },
                    { id: 'none', label: 'تعطيل الرسائل مؤقتاً' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrivacyMessages(opt.id)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                        privacyMessages === opt.id
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Visibility */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                <label className="text-xs font-bold text-neutral-200 font-tajawal">
                  من يمكنه رؤية ملفي الشخصي؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'everyone', label: 'الجميع (عام)' },
                    { id: 'friends_only', label: 'الأصدقاء فقط' },
                    { id: 'registered_only', label: 'الأعضاء المسجلون فقط' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrivacyProfile(opt.id)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                        privacyProfile === opt.id
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stories Visibility */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                <label className="text-xs font-bold text-neutral-200 font-tajawal">
                  من يمكنه رؤية قصصي (Stories)؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'everyone', label: 'الجميع' },
                    { id: 'friends_only', label: 'الأصدقاء فقط' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrivacyStories(opt.id)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                        privacyStories === opt.id
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Online Status & Last Seen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                  <label className="text-xs font-bold text-neutral-200 font-tajawal">
                    إظهار حالة الاتصال (Online)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPrivacyOnlineStatus('everyone')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        privacyOnlineStatus === 'everyone'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      ظاهر للجميع
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrivacyOnlineStatus('nobody')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        privacyOnlineStatus === 'nobody'
                          ? 'bg-neutral-700 text-white'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      إخفاء الحالة
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                  <label className="text-xs font-bold text-neutral-200 font-tajawal">
                    إظهار آخر ظهور (Last Seen)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPrivacyLastSeen('everyone')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        privacyLastSeen === 'everyone'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      ظاهر
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrivacyLastSeen('nobody')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        privacyLastSeen === 'nobody'
                          ? 'bg-neutral-700 text-white'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      مخفي
                    </button>
                  </div>
                </div>
              </div>

              {/* Allow/Disallow Friend Requests */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white font-tajawal">السماح بإضافتي للأصدقاء</h4>
                  <p className="text-[11px] text-neutral-400 font-tajawal">
                    السماح للمستخدمين بإرسال طلبات صداقة إليك.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyFriendRequests('everyone')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      privacyFriendRequests === 'everyone'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    مسموح
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacyFriendRequests('none')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      privacyFriendRequests === 'none'
                        ? 'bg-neutral-700 text-white'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    ممنوع
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              3. MEDIA SETTINGS SECTION
             ========================================= */}
          {activeSection === 'media' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-emerald-400" />
                  <span>إعدادات الوسائط والتنزيل</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  التحكم بالتحميل التلقائي للصور والفيديو، جودة الوسائط، والوسائط ذاتية التدمير.
                </p>
              </div>

              {/* Auto Download Toggles */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">التحميل التلقائي للصور</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">
                      تنزيل وعرض الصور فور وصولها في المحادثات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoDownloadImages(prev => !prev)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      autoDownloadImages ? 'bg-emerald-600 justify-start' : 'bg-neutral-800 justify-end'
                    }`}
                  >
                    <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">التحميل التلقائي للفيديو</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">
                      تنزيل مقاطع الفيديو تلقائياً أو عند النقر فقط لتوفير باقة البيانات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoDownloadVideo(prev => !prev)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      autoDownloadVideo ? 'bg-emerald-600 justify-start' : 'bg-neutral-800 justify-end'
                    }`}
                  >
                    <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">تشغيل الفيديو تلقائياً (Autoplay)</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">
                      بدء تشغيل مقاطع الفيديو في القصص والغرف فور ظهورها بصوت مكتوم.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoplayVideo(prev => !prev)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      autoplayVideo ? 'bg-emerald-600 justify-start' : 'bg-neutral-800 justify-end'
                    }`}
                  >
                    <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">العرض لمرة واحدة تلقائياً (View-Once)</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">
                      تفعيل خيار ➀ بشكل افتراضي عند إرفاق الصور الحساسة في الرسائل الخاصة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDefaultViewOnce(prev => !prev)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      defaultViewOnce ? 'bg-amber-600 justify-start' : 'bg-neutral-800 justify-end'
                    }`}
                  >
                    <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </button>
                </div>
              </div>

              {/* Media Quality */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                <label className="text-xs font-bold text-neutral-200 font-tajawal">
                  جودة تحميل ورفع الوسائط
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'high', label: 'دقة عالية (HD)' },
                    { id: 'standard', label: 'جودة قياسية (متوازنة)' },
                    { id: 'saver', label: 'موفر البيانات (Data Saver)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMediaQuality(opt.id as any)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                        mediaQuality === opt.id
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 shadow'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              4. SECURITY & SESSIONS SECTION
             ========================================= */}
          {activeSection === 'security' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-400" />
                  <span>الأمان والجلسات النشطة</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  تغيير كلمة المرور ومراجعة الأجهزة والجلسات المسجلة بحسابك.
                </p>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4">
                <h3 className="text-sm font-bold font-cairo text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>تغيير كلمة المرور</span>
                </h3>

                {passwordMsg && (
                  <div className={`p-3 rounded-xl text-xs font-tajawal flex items-center gap-2 ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-200'
                  }`}>
                    {passwordMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1 font-tajawal">
                      كلمة المرور الحالية
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm outline-none focus:border-emerald-500 font-tajawal"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1 font-tajawal">
                        كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="•••••••• (6 أحرف فأكثر)"
                        className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm outline-none focus:border-emerald-500 font-tajawal"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1 font-tajawal">
                        تأكيد كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm outline-none focus:border-emerald-500 font-tajawal"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-colors shadow-md shadow-emerald-600/10"
                >
                  {passwordLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                </button>
              </form>

              {/* Active Sessions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold font-cairo text-white">جلسات تسجيل الدخول النشطة</h3>
                    <p className="text-xs text-neutral-400 font-tajawal">
                      قائمة الأجهزة والمتصفحات المسجلة حالياً بحسابك.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    disabled={revokingSessions}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-bold font-tajawal cursor-pointer transition-colors"
                  >
                    {revokingSessions ? 'جاري الإنهاء...' : 'تسجيل الخروج من الأجهزة الأخرى'}
                  </button>
                </div>

                {sessionsLoading ? (
                  <div className="text-center py-6 text-xs text-neutral-400">جاري تحميل الجلسات...</div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          s.isCurrent
                            ? 'bg-emerald-950/20 border-emerald-600/40'
                            : 'bg-neutral-950/60 border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className={`w-5 h-5 ${s.isCurrent ? 'text-emerald-400' : 'text-neutral-400'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white font-tajawal">{s.deviceInfo}</span>
                              {s.isCurrent && (
                                <span className="text-[10px] bg-emerald-500 text-black font-black px-1.5 py-0.2 rounded">
                                  الجلسة الحالية
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-tajawal">
                              IP: {s.ipAddress || 'محمي'} · آخر نشاط: {new Date(s.lastActiveAt).toLocaleString('ar-EG')}
                            </div>
                          </div>
                        </div>

                        {s.isOnline && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="متصل الآن" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================
              5. ACCOUNT & REFERRALS SECTION
             ========================================= */}
          {activeSection === 'account' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <span>بيانات الحساب</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  معلومات عضويتك، تاريخ الانضمام، وكود الإحالة.
                </p>
              </div>

              {/* Account Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <span className="text-xs text-neutral-400 font-tajawal">معرّف الحساب</span>
                  <div className="text-sm font-mono text-white truncate">{user?.id || '—'}</div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <span className="text-xs text-neutral-400 font-tajawal">نوع الحساب</span>
                  <div className="text-sm font-bold text-emerald-400 font-cairo">
                    {user?.isGuest ? 'زائر مؤقت' : user?.role === 'owner' ? 'مالك المنصة' : user?.role === 'admin' ? 'مدير عام' : 'عضو مسجل'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <span className="text-xs text-neutral-400 font-tajawal">رصيد الكوينز</span>
                  <div className="text-sm font-bold text-amber-400 font-cairo">
                    {(user?.coins || 0).toLocaleString()} كوينز
                  </div>
                </div>
              </div>

              {/* Referral Code Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-900 border border-emerald-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white font-cairo flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>كود دعوة الأصدقاء الخاص بك</span>
                  </h4>
                  <p className="text-xs text-neutral-400 font-tajawal">
                    شارك كود الدعوة مع أصدقائك للحصول على مكافآت ونقاط خبرة عند انضمامهم.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={copyReferralCode}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-tajawal flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{copiedCode ? 'تم النسخ!' : `نسخ الكود: ${user?.referralCode || 'FADFADA'}`}</span>
                </button>
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-900/50 space-y-3">
                <div className="flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-cairo font-bold text-sm">منطقة الخطر — حذف الحساب</h3>
                </div>
                <p className="text-xs text-neutral-400 font-tajawal">
                  حذف الحساب نهائي وسيؤدي إلى مسح كافة بياناتك ورسائلك ورصيدك نهائياً ولا يمكن التراجع عنه.
                </p>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-tajawal cursor-pointer transition-colors"
                >
                  حذف حسابي نهائياً
                </button>
              </div>
            </div>
          )}

          {/* =========================================
              6. NOTIFICATIONS SECTION
             ========================================= */}
          {activeSection === 'notifications' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  <span>إعدادات الإشعارات والتنبيهات</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  تخصيص التنبيهات الصوتية والمرئية فور وصول رسائل أو تفاعلات جديدة.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">الأصوات والنغمات التنبيهية</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">تشغيل صوت خفيف وتنبيهات حية (Toast) عند استلام رسائل أو هدايا</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSound(!notifSound)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                      notifSound ? 'bg-emerald-600 justify-start' : 'bg-neutral-800 justify-end'
                    }`}
                  >
                    <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                  </button>
                </div>

                {/* Sound Customization Card */}
                {notifSound && (
                  <div className="p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-white font-cairo">
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>اختيار نغمة الإشعارات الحية:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => playNotificationSound(selectedSound, true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-tajawal flex items-center gap-1 cursor-pointer bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/40"
                      >
                        <span>تجربة النغمة 🔊</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {[
                        { id: 'chime', name: 'رنين ملكي ✨', desc: 'لحن ناعم فاخر' },
                        { id: 'bell', name: 'جرس بلوري 🔔', desc: 'نغمة جرس صافية' },
                        { id: 'pop', name: 'فقاعة ماء 💧', desc: 'صوت مائي خفيف' },
                        { id: 'marimba', name: 'ماريمبا 🎶', desc: 'نغمات موسيقية مرحة' }
                      ].map(snd => (
                        <button
                          key={snd.id}
                          type="button"
                          onClick={() => handleSoundChange(snd.id as SoundType)}
                          className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                            selectedSound === snd.id
                              ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          <div className="text-xs font-bold font-cairo">{snd.name}</div>
                          <div className="text-[10px] text-neutral-500 font-tajawal mt-0.5">{snd.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {[
                  { label: 'إشعارات الرسائل الخاصة', desc: 'عرض شريط تنبيه فوري بالرسائل الواردة', state: notifMessages, set: setNotifMessages },
                  { label: 'إشعارات طلبات الصداقة', desc: 'تنبيهك عندما يرسل لك شخص طلب صداقة', state: notifFriendReq, set: setNotifFriendReq },
                  { label: 'إشعارات الغرف والمجالس', desc: 'تنبيهك بالإشارات والرسائل في الغرف النشطة', state: notifRooms, set: setNotifRooms }
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white font-tajawal">{item.label}</h4>
                      <p className="text-[11px] text-neutral-400 font-tajawal">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => item.set(!item.state)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                        item.state ? 'bg-emerald-600 justify-start' : 'bg-neutral-800 justify-end'
                      }`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-md" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================
              7. MESSAGES & PREFERENCES SECTION
             ========================================= */}
          {activeSection === 'messages' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <span>تخصيص المحادثات والرسائل</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  مؤشرات القراءة، مؤشرات الكتابة، وطريقة عرض الرسائل الخاصة.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">مؤشرات القراءة (Read Receipts ✓✓)</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">
                      إظهار علامتي الصح الزرقاوين عند قراءة الطرف الآخر لرسائلك.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/40">
                    مفعّل دائماً
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white font-tajawal">مؤشر جاري الكتابة (Typing Indicator)</h4>
                    <p className="text-[11px] text-neutral-400 font-tajawal">
                      إظهار حالة "يكتب الآن..." أثناء كتابة الردود.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/40">
                    مفعّل لحظياً
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              8. APPEARANCE SECTION
             ========================================= */}
          {activeSection === 'appearance' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-400" />
                  <span>المظهر والتخصيص البصري</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  الوضع الليلي الفاخر وتأثيرات الإضاءة.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-neutral-950 border-2 border-emerald-500/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-cairo font-bold text-sm text-white">الوضع الليلي الفاخر (Dark Luxe)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-neutral-400 font-tajawal">
                    المظهر الافتراضي للمنصة مصمم بعناية فائقة لراحة العين وتجربة مستخدم ملكية.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-800 space-y-2 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="font-cairo font-bold text-sm text-neutral-400">الوضع النهاري (فاتح)</span>
                    <span className="text-[10px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded">قريباً</span>
                  </div>
                  <p className="text-xs text-neutral-500 font-tajawal">
                    متاح في التحديث القادم مع إمكانية التبديل التلقائي حسب توقيت جهازك.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              9. LANGUAGE SECTION
             ========================================= */}
          {activeSection === 'language' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-emerald-400" />
                  <span>اللغة والاتجاه</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  لغة واجهة المنصة واتجاه النصوص.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border-2 border-emerald-600 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white font-cairo">العربية (Arabic - RTL)</h4>
                    <p className="text-xs text-neutral-400 font-tajawal">اللغة الأساسية للمنصة بدعم كامل للخطوط العربية</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/40 border border-neutral-800 flex items-center justify-between opacity-60">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 font-cairo">English (LTR)</h4>
                    <p className="text-xs text-neutral-500 font-tajawal">Secondary language support</p>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-tajawal">قريباً</span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              10. BLOCKS & MUTES SECTION
             ========================================= */}
          {activeSection === 'blocks' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-neutral-800 pb-4">
                <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                  <UserX className="w-5 h-5 text-rose-400" />
                  <span>قائمة الحظر والكتم</span>
                </h2>
                <p className="text-xs text-neutral-400 font-tajawal mt-1">
                  إدارة المستخدمين المحظورين أو المكتومين بكل خصوصية وأمان.
                </p>

                {/* Sub-tabs for Blocks and Mutes */}
                <div className="flex items-center gap-2 mt-4 p-1 bg-neutral-900 border border-neutral-800 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setBlocksTab('blocks')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold font-cairo cursor-pointer transition-all ${
                      blocksTab === 'blocks'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50 shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    المحظورون ({blockedUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlocksTab('mutes')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold font-cairo cursor-pointer transition-all ${
                      blocksTab === 'mutes'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50 shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    المكتومون ({mutedUsers.length})
                  </button>
                </div>
              </div>

              {blocksTab === 'blocks' ? (
                blocksLoading ? (
                  <div className="text-center py-8 text-xs text-neutral-400 font-tajawal">جاري جلب القائمة...</div>
                ) : blockedUsers.length === 0 ? (
                  <div className="text-center py-12 bg-neutral-950/60 rounded-3xl border border-neutral-800 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto" />
                    <h4 className="font-cairo font-bold text-white text-sm">قائمة الحظر فارغة</h4>
                    <p className="text-xs text-neutral-400 font-tajawal">لم تقم بحظر أي مستخدم حتى الآن.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(b => (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center font-bold text-white text-xs">
                            {b.blockedUsername?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white font-cairo">{b.blockedUsername}</span>
                            <span className="text-[10px] text-neutral-500 font-tajawal block">
                              تاريخ الحظر: {new Date(b.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnblock(b.blockedUserId)}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-bold font-tajawal cursor-pointer transition-colors"
                        >
                          إلغاء الحظر
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                mutesLoading ? (
                  <div className="text-center py-8 text-xs text-neutral-400 font-tajawal">جاري جلب قائمة الكتم...</div>
                ) : mutedUsers.length === 0 ? (
                  <div className="text-center py-12 bg-neutral-950/60 rounded-3xl border border-neutral-800 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto" />
                    <h4 className="font-cairo font-bold text-white text-sm">قائمة الكتم فارغة</h4>
                    <p className="text-xs text-neutral-400 font-tajawal">لم تقم بكتم إشعارات أي مستخدم.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mutedUsers.map(m => (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center font-bold text-white text-xs">
                            {m.mutedUsername?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white font-cairo">{m.mutedUsername}</span>
                            <span className="text-[10px] text-neutral-500 font-tajawal block">
                              تم الكتم: {new Date(m.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnmute(m.mutedUserId)}
                          className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-bold font-tajawal cursor-pointer transition-colors"
                        >
                          إلغاء الكتم
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-neutral-900 border border-rose-900/60 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-cairo font-black text-white">تأكيد حذف الحساب نهائياً</h3>
              <p className="text-xs text-neutral-400 font-tajawal">
                هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم مسح حسابك وكافة محادثاتك وسجل رصيدك فوراً.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950 border border-rose-800 text-rose-200 text-xs font-tajawal">
                {deleteError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1 font-tajawal">
                اكتب كلمة المرور لتأكيد الهوية:
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="كلمة المرور الحالية"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-sm outline-none focus:border-rose-500 font-tajawal"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-rose-600/20"
              >
                {deletingAccount ? 'جاري الحذف...' : 'نعم، احذف حسابي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
