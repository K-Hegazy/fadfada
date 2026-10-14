import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Room, RoomMessage } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Compass,
  Plus,
  Lock,
  Users,
  Send,
  Sparkles,
  Shield,
  MessageSquare,
  X,
  CheckCircle2,
  ArrowRight,
  Info,
  Hash
} from 'lucide-react';

const ROOM_CATEGORIES = [
  'فضفضة عامة', 'أدب وشعر', 'تقنية وبرمجة', 'تجارب حياتية', 'ألعاب ومسابقات', 'تطوير الذات', 'موسيقى وفنون'
];

export const RoomsPage: React.FC = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [roomInput, setRoomInput] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Password Prompt Modal for Private Chat Rooms
  const [passwordModalRoom, setPasswordModalRoom] = useState<Room | null>(null);
  const [enteredPassword, setEnteredPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  // Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // References
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create Chat Room Modal State
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomDesc, setNewRoomDesc] = useState<string>('');
  const [newRoomCategory, setNewRoomCategory] = useState<string>('فضفضة عامة');
  const [newRoomRules, setNewRoomRules] = useState<string>('');
  const [newRoomPrivate, setNewRoomPrivate] = useState<boolean>(false);
  const [newRoomPassword, setNewRoomPassword] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ rooms: Room[] }>('/rooms?type=chat');
      setRooms(res.rooms || []);
    } catch (err) {
      console.error('Error fetching chat rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatRooms();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleJoinChatRoom = (room: Room) => {
    if (room.is_private && !isUserOwner({ role: user?.role, username: user?.username })) {
      setPasswordError('');
      setEnteredPassword('');
      setPasswordModalRoom(room);
    } else {
      enterChatRoom(room.id);
    }
  };

  const handleConfirmPassword = async () => {
    if (!passwordModalRoom) return;
    try {
      await apiRequest(`/rooms/${passwordModalRoom.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ password: enteredPassword })
      });
      const targetId = passwordModalRoom.id;
      setPasswordModalRoom(null);
      await enterChatRoom(targetId);
    } catch (err: any) {
      setPasswordError(err.message || 'كلمة المرور غير صحيحة');
    }
  };

  const enterChatRoom = async (roomId: string) => {
    try {
      await apiRequest(`/rooms/${roomId}/join`, { method: 'POST' }).catch(() => {});
      const res = await apiRequest<{ room: Room; messages: RoomMessage[]; members: any[] }>(
        `/rooms/${roomId}/messages`
      );
      setActiveRoomId(roomId);
      setActiveRoom(res.room);
      setRoomMessages(res.messages || []);
      setRoomMembers(res.members || []);
      scrollToBottom();
    } catch (err) {
      console.error('Error entering chat room:', err);
    }
  };

  // WebSockets for Real-time chat & members
  useEffect(() => {
    if (!activeRoomId) return;

    socketService.send({ type: 'room:join', roomId: activeRoomId });

    const unsubMsg = socketService.on('room:message', (data: any) => {
      if (data.roomId === activeRoomId && data.message) {
        setRoomMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    });

    const unsubJoin = socketService.on('room:user_joined', (data: any) => {
      if (data.roomId === activeRoomId && data.user) {
        setRoomMembers(prev => {
          if (prev.some(m => m.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    });

    const unsubLeave = socketService.on('room:user_left', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setRoomMembers(prev => prev.filter(m => m.id !== data.userId));
      }
    });

    return () => {
      socketService.send({ type: 'room:leave', roomId: activeRoomId });
      apiRequest(`/rooms/${activeRoomId}/leave`, { method: 'POST' }).catch(() => {});
      unsubMsg();
      unsubJoin();
      unsubLeave();
    };
  }, [activeRoomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !activeRoomId) return;

    try {
      const msg = await apiRequest<RoomMessage>(`/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: roomInput.trim() })
      });

      socketService.send({
        type: 'room:message',
        roomId: activeRoomId,
        message: msg
      });

      setRoomInput('');
      scrollToBottom();
    } catch (err) {
      console.error('Error sending room message:', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      setCreateError('يرجى كتابة اسم غرفة الشات');
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError('');
      const res = await apiRequest<{ room: Room }>('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDesc.trim(),
          category: newRoomCategory,
          roomType: 'chat',
          costPerMinute: 0,
          isPrivate: newRoomPrivate,
          password: newRoomPassword,
          rules: newRoomRules
        })
      });

      setCreateModalOpen(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomRules('');
      setNewRoomPassword('');
      setNewRoomPrivate(false);
      fetchChatRooms();
      if (res.room) {
        enterChatRoom(res.room.id);
      }
    } catch (err: any) {
      setCreateError(err.message || 'فشل إنشاء غرفة الشات');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredRooms = rooms.filter(r => {
    if (filterCategory === 'all') return true;
    return r.category === filterCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-tajawal">
      {/* Password Modal */}
      {passwordModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
              <h3 className="font-cairo font-bold text-base text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>غرفة شات خاصة محمية</span>
              </h3>
              <button onClick={() => setPasswordModalRoom(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              يرجى إدخال كلمة المرور لدخول غرفة الشات: <strong>{passwordModalRoom.name}</strong>
            </p>

            <input
              type="password"
              value={enteredPassword}
              onChange={e => setEnteredPassword(e.target.value)}
              placeholder="كلمة المرور..."
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-white text-xs outline-none"
              autoFocus
            />

            {passwordError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/50">
                {passwordError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmPassword}
                disabled={!enteredPassword}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                دخول الشات
              </button>
              <button
                type="button"
                onClick={() => setPasswordModalRoom(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 text-neutral-400 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && activeRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
              <h3 className="font-cairo font-bold text-base text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <span>قوانين وإرشادات غرفة {activeRoom.name}</span>
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#07090e] border border-neutral-800 text-xs text-neutral-300 leading-relaxed max-h-60 overflow-y-auto">
              {activeRoom.rules || 'الالتزام بالأدب والاحترام المتبادل بين جميع الأعضاء وتجنب المخالفات.'}
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0c1817] via-[#0b1c1c] to-[#0c1920] border border-emerald-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Compass className="w-3.5 h-3.5" />
              <span>رومات الشات والدردشة الكتابية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo">
              رومات الشات — مجالس الحوار الكتابي
            </h1>
            <p className="text-neutral-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              انضم إلى غرف الشات الجماعية المنظمة بحسب الاهتمامات للتواصل والتعبير والفضفضة بحرية مع أصدقائك في بيئة آمنة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-cairo font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء غرفة شات جديدة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!activeRoom ? (
          /* ROOMS LIST VIEW */
          <div className="lg:col-span-3 space-y-5">
            {/* Category Filter */}
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 flex-wrap gap-3">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 max-w-full">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    filterCategory === 'all'
                      ? 'bg-emerald-500 text-neutral-950 shadow-md'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  جميع التصنيفات
                </button>
                {ROOM_CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setFilterCategory(c)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      filterCategory === c
                        ? 'bg-emerald-500 text-neutral-950 shadow-md'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="text-xs text-neutral-400 font-tajawal">
                عدد غرف الشات: <span className="text-emerald-400 font-bold">{filteredRooms.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-neutral-400 font-tajawal text-sm">
                جاري تحميل رومات الشات...
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-20 bg-[#0b0e14] border border-neutral-850 rounded-3xl p-8 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <Compass className="w-8 h-8" />
                </div>
                <h3 className="font-cairo font-bold text-lg text-white">لا توجد غرف شات حالياً</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  ابدأ الآن بإنشاء أول غرفة شات كتابية حول موضوع يثير اهتمامك وادعُ الأعضاء للانضمام إليها.
                </p>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء أول غرفة شات</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map(room => (
                  <div
                    key={room.id}
                    className="group p-5 rounded-3xl bg-[#0c1214] hover:bg-[#0f1719] border border-neutral-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4 shadow-xl"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>شات كتابي</span>
                        </span>

                        {room.is_private ? (
                          <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800/50 flex items-center gap-1 font-bold">
                            <Lock className="w-3 h-3" />
                            <span>خاص</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-lg border border-neutral-800">
                            عام
                          </span>
                        )}
                      </div>

                      <h3 className="font-cairo font-bold text-base text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                        {room.name}
                      </h3>

                      {room.description && (
                        <p className="text-xs text-neutral-400 font-tajawal line-clamp-2 leading-relaxed">
                          {room.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-neutral-850 flex items-center justify-between text-xs text-neutral-400 font-tajawal">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{room.member_count || 0}</span>
                        </span>
                        <span className="text-neutral-500">·</span>
                        <span className="text-[11px] text-neutral-400">{room.category}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleJoinChatRoom(room)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        <span>دخول الشات</span>
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE CHAT ROOM VIEW */
          <div className="lg:col-span-3 bg-[#0a0d11] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[750px] max-h-[85vh]">
            {/* Top Room Bar */}
            <div className="p-4 sm:p-5 bg-[#0e1417] border-b border-neutral-800 flex items-center justify-between flex-wrap gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveRoomId(null);
                    setActiveRoom(null);
                  }}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                  title="العودة لغرف الشات"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-cairo font-black text-base sm:text-lg text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>{activeRoom.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      غرفة شات
                    </span>
                  </h2>
                  <div className="text-[11px] text-neutral-400 font-tajawal flex items-center gap-2">
                    <span>{roomMembers.length} عضو حاضر</span>
                    <span>·</span>
                    <span>التصنيف: {activeRoom.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeRoom.rules && (
                  <button
                    onClick={() => setShowRulesModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 font-tajawal flex items-center gap-1.5 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-emerald-400" />
                    <span>القوانين</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveRoomId(null);
                    setActiveRoom(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 border border-neutral-800 text-xs font-tajawal cursor-pointer"
                >
                  مغادرة الغرفة
                </button>
              </div>
            </div>

            {/* Chat Body: Messages + Online Members Sidebar */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar">
                  {roomMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-neutral-500 font-tajawal text-xs">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <p>مرحباً بك في غرفة الشات! ابدأ المحادثة وشارك أفكارك وتواصل مع الأعضاء الآن.</p>
                    </div>
                  ) : (
                    roomMessages.map(msg => {
                      const isMe = msg.sender_id === user?.id;
                      const senderName = msg.username || msg.sender_username || 'عضو';
                      const isFemale = (msg.gender || msg.sender_gender) === 'female';

                      return (
                        <div key={msg.id} className={`flex gap-3 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                              isFemale ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            }`}
                          >
                            {senderName.slice(0, 1).toUpperCase()}
                          </div>

                          <div className={`space-y-1 max-w-[85%] sm:max-w-[75%] ${isMe ? 'text-left' : 'text-right'}`}>
                            <div className={`flex items-center gap-1.5 text-[11px] text-neutral-400 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="font-bold text-white font-cairo">{senderName}</span>
                              {isUserOwner({ role: msg.role, username: senderName }) && <OwnerBadge size="xs" />}
                              {msg.role === 'creator' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-950 text-yellow-300 border border-yellow-800">
                                  💡 المبدع
                                </span>
                              )}
                              <span>·</span>
                              <span className="font-mono text-[10px]">
                                {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div
                              className={`p-3.5 rounded-2xl text-xs sm:text-sm font-tajawal leading-relaxed shadow-sm ${
                                isMe
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                                  : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-tl-none'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Bar */}
                <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-[#07090c] border-t border-neutral-800 flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={roomInput}
                    onChange={e => setRoomInput(e.target.value)}
                    placeholder="اكتب رسالتك في غرفة الشات..."
                    className="flex-1 bg-neutral-900/90 border border-neutral-800 focus:border-emerald-500 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none font-tajawal"
                  />
                  <button
                    type="submit"
                    disabled={!roomInput.trim()}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">إرسال</span>
                  </button>
                </form>
              </div>

              {/* Members Sidebar (Desktop: side, Mobile: hidden or collapsible) */}
              <div className="hidden md:flex flex-col w-60 shrink-0 border-r border-neutral-850 bg-[#080b0f] p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-xs font-bold text-white font-cairo flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>المتواجدون في الشات</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-emerald-400 font-bold border border-neutral-800">
                    {roomMembers.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {roomMembers.map((m, idx) => (
                    <div key={m.id || idx} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-neutral-900/60">
                      <div className="w-7 h-7 rounded-xl bg-neutral-850 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                        {m.username?.slice(0, 1).toUpperCase() || '👤'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span>{m.username}</span>
                          {isUserOwner({ role: m.role, username: m.username }) && <OwnerBadge size="xs" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Chat Room Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1417] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                إنشاء غرفة شات كتابية
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  اسم غرفة الشات
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="مثال: ديوانية الأصدقاء، نقاشات سينمائية..."
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-white text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  التصنيف
                </label>
                <select
                  value={newRoomCategory}
                  onChange={e => setNewRoomCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-white text-xs outline-none"
                >
                  {ROOM_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  نبذة عن الغرفة
                </label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  placeholder="موضوع الدردشة والهدف من الغرفة..."
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-white text-xs outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  قوانين وإرشادات الغرفة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={newRoomRules}
                  onChange={e => setNewRoomRules(e.target.value)}
                  placeholder="قواعد المشاركة الخاصة بالغرفة..."
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500 text-white text-xs outline-none resize-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#080b0f] border border-neutral-850 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newRoomPrivate}
                    onChange={e => setNewRoomPrivate(e.target.checked)}
                    className="rounded border-neutral-700 text-emerald-600 focus:ring-0"
                  />
                  <span className="text-xs text-white font-bold">غرفة شات خاصة (بكلمة مرور)</span>
                </label>

                {newRoomPrivate && (
                  <input
                    type="password"
                    required={newRoomPrivate}
                    value={newRoomPassword}
                    onChange={e => setNewRoomPassword(e.target.value)}
                    placeholder="أدخل كلمة مرور الغرفة..."
                    className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs outline-none"
                  />
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newRoomName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-cairo font-bold text-xs disabled:opacity-40 cursor-pointer shadow-md"
                >
                  {createLoading ? 'جاري الإنشاء...' : 'إنشاء غرفة الشات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
