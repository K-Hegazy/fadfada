import React, { useEffect, useState } from 'react';
import {
  Check,
  Flag,
  Heart,
  HeartHandshake,
  HelpCircle,
  Lock,
  MessageCircle,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createSupportTicket,
  divorceMarriage,
  removeFriend,
  respondFriendRequest,
  respondMarriage,
  subscribeToAppeals,
  subscribeToReports,
  subscribeToSupportTickets,
  submitAppeal,
} from '../services/economy';
import { useApp } from '../state/AppContext';
import type { AppealItem, Marriage, Relationship, ReportItem, SupportTicket } from '../types/fadfada';
import { formatArabicTime } from '../utils/formatters';
import { displayCountryName } from '../utils/progression';
import { Avatar } from './Avatar';
import { EmptyState, FeedbackBanner, PageHeader, SegmentedTabs } from './ui/Primitives';

type SocialTab =
  | 'friends'
  | 'friend_requests'
  | 'marriage'
  | 'marriage_requests'
  | 'relations'
  | 'support'
  | 'reports';

export const SocialHubView: React.FC = () => {
  const {
    profile,
    isGuest,
    usersById,
    relationships,
    marriages,
    openChatWith,
    openProfileModal,
    isPeerOnline,
    setActiveSection,
  } = useApp();

  const [tab, setTab] = useState<SocialTab>('friends');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { kind: 'unfriend'; rel: Relationship; peerName: string }
    | { kind: 'divorce'; marriage: Marriage; partnerName: string }
    | null
  >(null);

  useEffect(() => {
    if (!profile) return;
    const u1 = subscribeToSupportTickets(profile.uid, false, setTickets);
    const u2 = subscribeToReports(profile.uid, false, setReports);
    const u3 = subscribeToAppeals(profile.uid, false, setAppeals);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [profile?.uid]);

  if (!profile) return null;

  const incomingRequests = relationships.filter(
    (r) => r.status === 'pending' && r.recipientId === profile.uid
  );
  const outgoingRequests = relationships.filter(
    (r) => r.status === 'pending' && r.requesterId === profile.uid
  );
  const friends = relationships.filter((r) => r.status === 'accepted');

  const activeMarriage = marriages.find((m) => m.status === 'accepted') ?? null;
  const incomingProposals = marriages.filter(
    (m) => m.status === 'pending' && m.partnerId === profile.uid
  );
  const sentProposals = marriages.filter(
    (m) => m.status === 'pending' && m.proposerId === profile.uid
  );

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    setError(null);
    setFeedback(null);
    try {
      await createSupportTicket(profile, ticketSubject, ticketMessage);
      setTicketSubject('');
      setTicketMessage('');
      setFeedback('تم فتح تذكرة الدعم الفني بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فتح تذكرة الدعم الفني.');
    }
  };

  const handleCreateAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim()) return;
    setError(null);
    setFeedback(null);
    try {
      await submitAppeal(profile, appealReason);
      setAppealReason('');
      setFeedback('تم إرسال الالتماس للمراجعة من الإدارة.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الالتماس.');
    }
  };

  const activePartnerUid = activeMarriage
    ? activeMarriage.proposerId === profile.uid
      ? activeMarriage.partnerId
      : activeMarriage.proposerId
    : '';
  const activePartnerUser = activePartnerUid ? usersById[activePartnerUid] : undefined;
  const activePartnerName = activeMarriage
    ? activeMarriage.proposerId === profile.uid
      ? activeMarriage.partnerName
      : activeMarriage.proposerName
    : '';

  const renderGuestGate = (title: string) => (
    <div className="p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 text-center space-y-2.5">
      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
        <Lock className="w-5 h-5" />
      </div>
      <h3 className="font-display text-sm font-bold">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        الصداقات وعقود الزواج الافتراضية متاحة للأعضاء المسجلين فقط. يمكنك ترقية حسابك من صفحة الحساب مع الاحتفاظ بمحادثاتك.
      </p>
      <button
        type="button"
        onClick={() => setActiveSection('settings')}
        className="min-h-[36px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
      >
        الانتقال لترقية الحساب
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-3.5">
        <PageHeader
          title="الزواج والأصدقاء"
          subtitle="إدارة الأصدقاء، طلبات الصداقة، الزواج، طلبات الزواج، العلاقات الحالية، والدعم الفني"
          icon={<HeartHandshake className="w-4 h-4" />}
        />

        <SegmentedTabs<SocialTab>
          value={tab}
          onChange={(next) => {
            setTab(next);
            setFeedback(null);
            setError(null);
          }}
          items={[
            { id: 'friends', label: 'الأصدقاء', icon: Users, count: friends.length },
            {
              id: 'friend_requests',
              label: 'طلبات الصداقة',
              icon: UserPlus,
              count: incomingRequests.length,
            },
            { id: 'marriage', label: 'الزواج', icon: Heart },
            {
              id: 'marriage_requests',
              label: 'طلبات الزواج',
              icon: HeartHandshake,
              count: incomingProposals.length,
            },
            { id: 'relations', label: 'العلاقات الحالية', icon: UserCheck },
            { id: 'support', label: 'الدعم الفني', icon: HelpCircle, count: tickets.length },
            { id: 'reports', label: 'البلاغات والالتماسات', icon: Flag },
          ]}
        />

        {feedback && <FeedbackBanner type="success" message={feedback} />}
        {error && <FeedbackBanner type="error" message={error} />}

        {/* Tab 1: Friends */}
        {tab === 'friends' &&
          (isGuest ? (
            renderGuestGate('قائمة الأصدقاء متاحة للأعضاء المؤكدين')
          ) : (
            <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <h2 className="font-display text-sm font-bold">قائمة الأصدقاء ({friends.length})</h2>
              {friends.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-5 h-5" />}
                  title="قائمة الأصدقاء فارغة"
                  description="يمكنك إرسال طلب صداقة من الملف الشخصي لأي عضو في المتواجدين الآن."
                />
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                  {friends.map((rel) => {
                    const peerUid = rel.participantIds.find((id) => id !== profile.uid) ?? '';
                    const peer = usersById[peerUid];
                    if (!peer) return null;
                    return (
                      <div key={rel.id} className="py-2.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => openProfileModal(peer.uid)}
                          className="flex items-center gap-2.5 text-right cursor-pointer"
                        >
                          <Avatar
                            src={peer.avatar}
                            name={peer.displayName}
                            size="md"
                            frameId={peer.frameId}
                            isOnline={isPeerOnline(peer)}
                            showPresence
                          />
                          <div>
                            <p className="text-sm font-bold">{peer.displayName}</p>
                            <p className="text-[11px] text-slate-400">
                              <span dir="ltr" className="font-mono">@{peer.username}</span> ·{' '}
                              {displayCountryName(peer.country, peer.countryFlag)}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openChatWith(peer.uid)}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] cursor-pointer"
                            title="محادثة"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                kind: 'unfriend',
                                rel,
                                peerName: peer.displayName,
                              })
                            }
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="إزالة صديق"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

        {/* Tab 2: Friend Requests */}
        {tab === 'friend_requests' &&
          (isGuest ? (
            renderGuestGate('طلبات الصداقة متاحة للأعضاء المؤكدين')
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
                <h2 className="font-display text-sm font-bold">
                  طلبات الصداقة الواردة ({incomingRequests.length})
                </h2>
                {incomingRequests.length === 0 ? (
                  <EmptyState
                    icon={<UserPlus className="w-5 h-5" />}
                    title="لا توجد طلبات صداقة واردة"
                    description="عندما يرسل لك أحد الأعضاء طلب صداقة سيظهر هنا للقبول أو الرفض."
                  />
                ) : (
                  <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                    {incomingRequests.map((rel) => {
                      const sender = usersById[rel.requesterId];
                      return (
                        <div key={rel.id} className="py-2.5 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => openProfileModal(rel.requesterId)}
                            className="flex items-center gap-2.5 text-right cursor-pointer"
                          >
                            <Avatar src={sender?.avatar} name={sender?.displayName ?? 'عضو'} size="sm" />
                            <div>
                              <span className="text-sm font-semibold block">
                                {sender?.displayName ?? 'عضو'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {displayCountryName(sender?.country, sender?.countryFlag)}
                              </span>
                            </div>
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await respondFriendRequest(rel, profile.uid, true);
                                  setFeedback('تم قبول طلب الصداقة.');
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'تعذر قبول الطلب.');
                                }
                              }}
                              className="min-h-[34px] px-3 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>قبول</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await respondFriendRequest(rel, profile.uid, false);
                                  setFeedback('تم رفض طلب الصداقة.');
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'تعذر رفض الطلب.');
                                }
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {outgoingRequests.length > 0 && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2">
                  <h2 className="font-display text-sm font-bold">
                    طلبات الصداقة المرسلة ({outgoingRequests.length})
                  </h2>
                  <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                    {outgoingRequests.map((rel) => {
                      const recipient = usersById[rel.recipientId];
                      return (
                        <div key={rel.id} className="py-2 flex items-center justify-between text-xs">
                          <span className="font-semibold">
                            {recipient?.displayName ?? 'عضو'}
                          </span>
                          <span className="text-slate-400">بانتظار الموافقة</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* Tab 3: Marriage Status */}
        {tab === 'marriage' &&
          (isGuest ? (
            renderGuestGate('نظام الزواج الافتراضي متاح للأعضاء المؤكدين')
          ) : (
            <div className="space-y-3">
              {activeMarriage ? (
                <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-rose-200 dark:border-rose-900/60 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <HeartHandshake className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      <h2 className="font-display text-sm sm:text-base font-bold">بطاقة الارتباط الموثّقة</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          kind: 'divorce',
                          marriage: activeMarriage,
                          partnerName: activePartnerName,
                        })
                      }
                      className="min-h-[34px] px-3 rounded-lg border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
                    >
                      إنهاء الارتباط (طلاق)
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={profile.avatar}
                        name={profile.displayName}
                        size="lg"
                        frameId={profile.frameId}
                      />
                      <span className="font-display text-sm font-bold">{profile.displayName}</span>
                    </div>

                    <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4 fill-current" />
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={activePartnerUser?.avatar}
                        name={activePartnerName}
                        size="lg"
                        frameId={activePartnerUser?.frameId}
                      />
                      <span className="font-display text-sm font-bold">{activePartnerName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>
                      المهر المتفق عليه:{' '}
                      <strong className="font-mono tabular-nums">{activeMarriage.dowry}</strong> عملة
                    </span>
                    <span>
                      نصيب الشريك:{' '}
                      <strong className="font-mono tabular-nums">{activeMarriage.wifeShare}</strong> عملة
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<HeartHandshake className="w-5 h-5" />}
                  title="لست متزوجًا افتراضيًا حاليًا"
                  description="يمكنك إرسال عرض زواج افتراضي مع مهر من العملات من الملف الشخصي لأي عضو في المتواجدين الآن."
                  action={
                    <button
                      type="button"
                      onClick={() => setActiveSection('online')}
                      className="min-h-[36px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
                    >
                      تصفح المتواجدين الآن
                    </button>
                  }
                />
              )}
            </div>
          ))}

        {/* Tab 4: Marriage Requests */}
        {tab === 'marriage_requests' &&
          (isGuest ? (
            renderGuestGate('طلبات الزواج متاحة للأعضاء المؤكدين')
          ) : (
            <div className="space-y-3">
              {incomingProposals.length > 0 && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
                  <h2 className="font-display text-sm font-bold">عروض الزواج الواردة</h2>
                  {incomingProposals.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-sm">{m.proposerName}</span>
                        <span className="font-mono tabular-nums text-[#0B7A62] dark:text-[#34D399] font-semibold">
                          المهر: {m.dowry} عملة (نصيبك: {m.wifeShare})
                        </span>
                      </div>
                      {m.message && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {m.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setError(null);
                            try {
                              await respondMarriage(m, profile.uid, true);
                              setFeedback('مبارك! تم قبول عرض الزواج.');
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'تعذر قبول عرض الزواج.');
                            }
                          }}
                          className="min-h-[34px] px-3.5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
                        >
                          قبول الزواج
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setError(null);
                            try {
                              await respondMarriage(m, profile.uid, false);
                              setFeedback('تم رفض عرض الزواج ورد المهر.');
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'تعذر رفض عرض الزواج.');
                            }
                          }}
                          className="min-h-[34px] px-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-xs cursor-pointer"
                        >
                          رفض ورد المهر
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sentProposals.length > 0 && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-1.5">
                  <h2 className="font-display text-sm font-bold">عروض الزواج المرسلة</h2>
                  {sentProposals.map((m) => (
                    <p key={m.id} className="text-xs text-slate-600 dark:text-slate-300">
                      عرض إلى <strong>{m.partnerName}</strong> بمهر{' '}
                      <span className="font-mono">{m.dowry}</span> عملة — بانتظار الرد.
                    </p>
                  ))}
                </div>
              )}

              {incomingProposals.length === 0 && sentProposals.length === 0 && (
                <EmptyState
                  icon={<HeartHandshake className="w-5 h-5" />}
                  title="لا توجد طلبات زواج معلقة"
                  description="ستظهر هنا عروض الزواج الواردة والمرسلة بمجرد إرسالها."
                />
              )}
            </div>
          ))}

        {/* Tab 5: Current Relations Overview */}
        {tab === 'relations' &&
          (isGuest ? (
            renderGuestGate('العلاقات الحالية متاحة للأعضاء المؤكدين')
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10">
                  <p className="text-[11px] text-slate-500">الحالة الاجتماعية</p>
                  <p className="font-display text-sm font-bold mt-0.5 text-slate-900 dark:text-slate-50">
                    {activeMarriage ? `متزوج من ${activePartnerName}` : 'أعزب'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10">
                  <p className="text-[11px] text-slate-500">الأصدقاء الحاليون</p>
                  <p className="font-mono tabular-nums text-sm font-bold mt-0.5 text-[#0B7A62] dark:text-[#34D399]">
                    {friends.length} صديق
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10">
                  <p className="text-[11px] text-slate-500">الطلبات المعلقة</p>
                  <p className="font-mono tabular-nums text-sm font-bold mt-0.5 text-amber-600 dark:text-amber-400">
                    {incomingRequests.length + incomingProposals.length} وارد
                  </p>
                </div>
              </div>

              {activeMarriage && activePartnerUser && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={activePartnerUser.avatar}
                      name={activePartnerName}
                      size="md"
                      frameId={activePartnerUser.frameId}
                      isOnline={isPeerOnline(activePartnerUser)}
                      showPresence
                    />
                    <div>
                      <p className="text-sm font-bold">{activePartnerName}</p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                        شريك الزواج الافتراضي
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openChatWith(activePartnerUser.uid)}
                    className="min-h-[34px] px-3 rounded-lg bg-[#0B7A62] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>مراسلة</span>
                  </button>
                </div>
              )}

              {friends.length === 0 && !activeMarriage && (
                <EmptyState
                  icon={<UserCheck className="w-5 h-5" />}
                  title="لا توجد علاقات حالية بعد"
                  description="ابدأ بتكوين صداقات من قائمة المتواجدين الآن لتظهر علاقاتك هنا."
                />
              )}
            </div>
          ))}

        {/* Support Tickets Tab */}
        {tab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <form
              onSubmit={handleCreateTicket}
              className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3"
            >
              <h2 className="font-display text-sm sm:text-base font-bold">فتح تذكرة دعم فني</h2>
              <input
                type="text"
                required
                maxLength={120}
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="موضوع المشكلة أو الاستفسار..."
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
              />
              <textarea
                rows={4}
                required
                maxLength={1500}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="اشرح تفاصيل مشكلتك..."
                className="w-full p-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
              />
              <button
                type="submit"
                className="w-full min-h-[40px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                إرسال التذكرة
              </button>
            </form>

            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <h2 className="font-display text-sm sm:text-base font-bold">تذاكري السابقة</h2>
              {tickets.length === 0 ? (
                <EmptyState
                  icon={<HelpCircle className="w-5 h-5" />}
                  title="لا توجد تذاكر دعم"
                  description="عند إرسال تذكرة سيظهر رد فريق الإدارة هنا."
                />
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                  {tickets.map((t) => (
                    <div key={t.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{t.subject}</span>
                        <span className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399]">
                          {t.status === 'answered' ? 'تم الرد' : t.status === 'closed' ? 'مغلقة' : 'مفتوحة'}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t.message}</p>
                      {t.adminReply && (
                        <p className="p-2 rounded-lg bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399]">
                          <strong>رد الإدارة:</strong> {t.adminReply}
                        </p>
                      )}
                      <p className="text-[10px] font-mono tabular-nums text-slate-400">
                        {formatArabicTime(t.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reports & Appeals Tab */}
        {tab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <h2 className="font-display text-sm sm:text-base font-bold">بلاغاتي المرسلة</h2>
              {reports.length === 0 ? (
                <EmptyState
                  icon={<Flag className="w-5 h-5" />}
                  title="لم ترسل أي بلاغات"
                  description="سجل البلاغات التي قمت برفعها للمراجعة سيظهر هنا."
                />
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                  {reports.map((r) => (
                    <div key={r.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>ضد: {r.targetName}</span>
                        <span>
                          {r.status === 'resolved' ? 'تمت المعالجة' : r.status === 'dismissed' ? 'مغلق' : 'قيد المراجعة'}
                        </span>
                      </div>
                      <p className="text-slate-500">
                        {r.reason} — {r.details}
                      </p>
                      {r.adminNote && (
                        <p className="text-[#0B7A62] dark:text-[#34D399]">ملاحظة الإدارة: {r.adminNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <h2 className="font-display text-sm sm:text-base font-bold">التماسات فك الحظر</h2>
              <form onSubmit={handleCreateAppeal} className="space-y-2">
                <textarea
                  rows={2}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="إذا كنت مقيدًا أو محظورًا اكتب سبب الالتماس هنا..."
                  className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs"
                />
                <button
                  type="submit"
                  className="min-h-[36px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
                >
                  تقديم التماس
                </button>
              </form>
              {appeals.map((a) => (
                <div
                  key={a.id}
                  className="p-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 text-xs space-y-1"
                >
                  <div className="flex justify-between font-bold">
                    <span>الحالة: {a.status === 'accepted' ? 'مقبول' : a.status === 'rejected' ? 'مرفوض' : 'معلق'}</span>
                    <span className="font-mono tabular-nums text-[10px] text-slate-400">
                      {formatArabicTime(a.createdAt)}
                    </span>
                  </div>
                  <p>{a.reason}</p>
                  {a.adminNote && (
                    <p className="text-[#0B7A62] dark:text-[#34D399]">رد الإدارة: {a.adminNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 p-5 space-y-3.5 shadow-2xl fadfada-modal-in">
            <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
              {confirmAction.kind === 'unfriend' ? 'تأكيد إزالة الصديق' : 'تأكيد إنهاء الارتباط'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmAction.kind === 'unfriend'
                ? `هل أنت متأكد من إزالة ${confirmAction.peerName} من قائمة أصدقائك؟`
                : `هل أنت متأكد من إنهاء عقد الزواج مع ${confirmAction.partnerName}؟`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="min-h-[36px] px-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmAction;
                  setConfirmAction(null);
                  setError(null);
                  try {
                    if (target.kind === 'unfriend') {
                      await removeFriend(target.rel, profile.uid);
                      setFeedback(`تمت إزالة ${target.peerName} من قائمة الأصدقاء.`);
                    } else {
                      await divorceMarriage(target.marriage, profile.uid);
                      setFeedback('تم إنهاء عقد الزواج.');
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'تعذر تنفيذ العملية.');
                  }
                }}
                className="min-h-[36px] px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
