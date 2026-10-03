import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { EventItem } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Sparkles,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Share2,
  AlertCircle,
  X,
  Radio,
  Trophy,
  BookOpen,
  HeartHandshake,
  PartyPopper,
  Edit2,
  Trash2
} from 'lucide-react';

interface EventsPageProps {
  onOpenProfile?: (userId: string) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Selected event for detail view modal
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);

  // Create Event Modal (Owner & Admin only)
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('مجالس شعر وأدب');
  const [newDateDisplay, setNewDateDisplay] = useState('');
  const [newTimeDisplay, setNewTimeDisplay] = useState('09:00 م');
  const [newLocation, setNewLocation] = useState('مجلس ديوان العرب (صوتي)');
  const [newMaxParticipants, setNewMaxParticipants] = useState('200');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newStatus, setNewStatus] = useState<'upcoming' | 'ongoing' | 'completed'>('upcoming');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.username?.toLowerCase() === 'hegazy';

  const categories = [
    { key: 'all', label: 'كافة التصنيفات' },
    { key: 'مجالس شعر وأدب', label: 'شعر وأدب' },
    { key: 'ألعاب ومسابقات', label: 'مسابقات وتحديات' },
    { key: 'تطوير ودعم نفسي', label: 'دعم نفسي وتطوير' },
    { key: 'احتفال وتكريم', label: 'احتفالات وتكريم' },
    { key: 'قصص وتجارب', label: 'قصص وتجارب' }
  ];

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ events: EventItem[] }>(`/events?filter=${filter}`);
      if (res && res.events) {
        setEvents(res.events);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const handleOpenDetail = async (eventId: string) => {
    try {
      setDetailLoading(true);
      const res = await apiRequest<{ event: EventItem }>(`/events/${eventId}`);
      if (res && res.event) {
        setSelectedEvent(res.event);
      }
    } catch (err) {
      console.error('Failed to load event details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleJoin = async (eventId: string) => {
    try {
      setJoiningEventId(eventId);
      const res = await apiRequest<{ success: boolean; isJoined: boolean; participantsCount: number; message: string }>(
        `/events/${eventId}/join`,
        { method: 'POST' }
      );

      if (res && res.success) {
        // Update in list
        setEvents(prev =>
          prev.map(ev =>
            ev.id === eventId
              ? { ...ev, isJoined: res.isJoined, participantsCount: res.participantsCount }
              : ev
          )
        );

        // Update in detail modal if open
        if (selectedEvent && selectedEvent.id === eventId) {
          setSelectedEvent(prev =>
            prev ? { ...prev, isJoined: res.isJoined, participantsCount: res.participantsCount } : null
          );
        }

        setSuccessToast(res.message);
        setTimeout(() => setSuccessToast(''), 3500);
      }
    } catch (err: any) {
      console.error('Failed to join/leave event:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تعديل التسجيل');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setJoiningEventId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingEventId(null);
    setNewTitle('');
    setNewDescription('');
    setNewCategory('مجالس شعر وأدب');
    setNewDateDisplay('');
    setNewTimeDisplay('09:00 م');
    setNewLocation('مجلس ديوان العرب (صوتي)');
    setNewMaxParticipants('200');
    setNewImageUrl('');
    setNewStatus('upcoming');
    setErrorMsg('');
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (ev: EventItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEventId(ev.id);
    setNewTitle(ev.title);
    setNewDescription(ev.description);
    setNewCategory(ev.category);
    setNewDateDisplay(ev.dateDisplay || '');
    setNewTimeDisplay(ev.timeDisplay || '09:00 م');
    setNewLocation(ev.location || 'المجلس العام');
    setNewMaxParticipants(ev.maxParticipants.toString());
    setNewImageUrl(ev.imageUrl || '');
    setNewStatus(ev.status as any || 'upcoming');
    setErrorMsg('');
    setCreateModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف فعالية: "${title}"؟`)) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/events/${eventId}`, {
        method: 'DELETE'
      });
      if (res && res.success) {
        setSuccessToast('تم حذف الفعالية بنجاح');
        setTimeout(() => setSuccessToast(''), 3500);
        if (selectedEvent && selectedEvent.id === eventId) {
          setSelectedEvent(null);
        }
        fetchEvents();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر حذف الفعالية');
    }
  };

  const handleCreateOrUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      setErrorMsg('يرجى ملء عنوان ووصف الفعالية');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        dateDisplay: newDateDisplay.trim() || new Date().toLocaleDateString('ar-EG'),
        timeDisplay: newTimeDisplay.trim() || '08:30 م',
        location: newLocation.trim() || 'المجلس العام',
        maxParticipants: parseInt(newMaxParticipants) || 150,
        imageUrl: newImageUrl.trim(),
        status: newStatus
      };

      if (editingEventId) {
        const res = await apiRequest<{ success: boolean; message: string }>(`/events/${editingEventId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (res && res.success) {
          setCreateModalOpen(false);
          setSuccessToast('تم تحديث الفعالية بنجاح!');
          setTimeout(() => setSuccessToast(''), 3500);
          fetchEvents();
          if (selectedEvent && selectedEvent.id === editingEventId) {
            handleOpenDetail(editingEventId);
          }
        }
      } else {
        const res = await apiRequest<{ success: boolean; eventId: string; message: string }>('/events', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (res && res.success) {
          setCreateModalOpen(false);
          setSuccessToast('تم إنشاء الفعالية بنجاح ونشرها للأعضاء!');
          setTimeout(() => setSuccessToast(''), 3500);
          fetchEvents();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر حفظ الفعالية');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvents = events.filter(ev => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.location && ev.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || ev.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const upcomingCount = events.filter(e => e.status === 'upcoming' || e.status === 'ongoing').length;
  const pastCount = events.filter(e => e.status === 'completed').length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in" dir="rtl">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold font-tajawal">{successToast}</span>
        </div>
      )}

      {/* Hero Banner Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950/80 via-neutral-900 to-[#0c0e16] border border-indigo-500/30 p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>جدول أنشطة ومجالس فضفضه</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white flex items-center gap-2.5">
              <span>الفعاليات الرسمية</span>
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 font-tajawal max-w-2xl leading-relaxed">
              انضم إلى الأمسيات الأدبية، المسابقات التنافسية، وحلقات النقاش الحصرية. سجّل حضورك وتفاعل مع نخبة مجتمع فضفضه في بيئة حوارية راقية.
            </p>
          </div>

          {/* Owner/Admin Action Button */}
          {isOwnerOrAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة فعالية جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs (All, Upcoming, Past) & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-neutral-100 text-neutral-900 shadow-md'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>كافة الفعاليات</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300">
              {events.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filter === 'upcoming'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>الفعاليات القادمة</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300">
              {upcomingCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filter === 'past'
                ? 'bg-neutral-700 text-white shadow-md'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <span>الفعاليات السابقة</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300">
              {pastCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الفعاليات والمجالس..."
            className="w-full bg-[#0b0d14] border border-neutral-800 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categories Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCategory(c.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === c.key
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800/80 hover:text-neutral-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-tajawal">جاري تحميل الفعاليات...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c0e16] border border-neutral-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-neutral-500 mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-cairo font-bold text-white text-base">لا توجد فعاليات مطابقة</h3>
          <p className="text-xs text-neutral-400 font-tajawal max-w-sm mx-auto">
            لم نجد أي فعالية تطابق خيارات البحث الحالية. يمكنك تغيير التصنيف أو مسح البحث.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredEvents.map((ev) => {
            const isCompleted = ev.status === 'completed';
            const isOngoing = ev.status === 'ongoing';

            return (
              <div
                key={ev.id}
                className="bg-[#0c0e17] border border-neutral-800/90 rounded-2xl sm:rounded-3xl overflow-hidden hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between group shadow-xl hover:shadow-2xl hover:shadow-indigo-500/5"
              >
                <div>
                  {/* Card Cover Image */}
                  <div className="relative h-44 sm:h-48 w-full bg-neutral-900 overflow-hidden">
                    {ev.imageUrl ? (
                      <img
                        src={ev.imageUrl}
                        alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-neutral-950 via-indigo-950 to-neutral-900">
                        <Calendar className="w-12 h-12 text-indigo-400/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e17] via-transparent to-black/40" />

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {isCompleted ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-900/90 border border-neutral-700 text-neutral-400 backdrop-blur-md">
                          فعالية سابقة (منتهية)
                        </span>
                      ) : isOngoing ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/90 border border-rose-500 text-rose-300 backdrop-blur-md flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          جارية الآن
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 backdrop-blur-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          قادمة قريباً
                        </span>
                      )}
                    </div>

                    {/* Category Tag */}
                    <div className="absolute bottom-3 right-3">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-black/70 border border-neutral-700/60 text-indigo-300 backdrop-blur-md">
                        {ev.category}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Meta bar: Date, Time & Location */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 font-tajawal">
                      <div className="flex items-center gap-1 text-indigo-300 font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{ev.dateDisplay || 'قريباً'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{ev.timeDisplay || '09:00 م'}</span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1 text-neutral-400 truncate max-w-[140px]">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => handleOpenDetail(ev.id)}
                      className="font-cairo font-bold text-base sm:text-lg text-white hover:text-indigo-400 transition-colors cursor-pointer line-clamp-1"
                      title={ev.title}
                    >
                      {ev.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-neutral-400 font-tajawal line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>

                    {/* Organizer / Creator with Owner Badge */}
                    <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400 font-tajawal">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-neutral-500">الجهة المنظمة:</span>
                        <span className="font-semibold text-neutral-200">{ev.creatorName}</span>
                        {isUserOwner({ role: ev.creatorRole, username: ev.creatorName }) && (
                          <OwnerBadge size="xs" />
                        )}
                      </div>

                      {/* Participant Capacity */}
                      <div className="flex items-center gap-1 text-neutral-400" title="المشاركون">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-[11px] font-bold text-neutral-300">
                          {ev.participantsCount} / {ev.maxParticipants}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 sm:p-5 pt-0 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDetail(ev.id)}
                    className="flex-1 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer text-center"
                  >
                    عرض التفاصيل
                  </button>

                  {/* Owner Controls */}
                  {isOwnerOrAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleOpenEditModal(ev, e)}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 border border-neutral-800 cursor-pointer transition-colors"
                        title="تعديل الفعالية"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteEvent(ev.id, ev.title, e)}
                        className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 hover:text-white cursor-pointer transition-colors"
                        title="حذف الفعالية"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {!isCompleted && (
                    <button
                      onClick={() => handleToggleJoin(ev.id)}
                      disabled={joiningEventId === ev.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        ev.isJoined
                          ? 'bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-500/80'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                    >
                      {ev.isJoined ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>مسجّل ✓</span>
                        </>
                      ) : (
                        <span>تسجيل حضور</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0d0f17] border border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header Cover */}
            <div className="relative h-48 sm:h-56 w-full bg-neutral-900 shrink-0">
              {selectedEvent.imageUrl ? (
                <img
                  src={selectedEvent.imageUrl}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-neutral-950 via-indigo-950 to-neutral-900">
                  <Calendar className="w-14 h-14 text-indigo-400/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f17] via-transparent to-black/60" />

              {/* Close Button */}
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 left-4 p-2 rounded-full bg-black/70 hover:bg-black text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Category & Status */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-600/90 text-white shadow-lg">
                  {selectedEvent.category}
                </span>
                <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                  selectedEvent.status === 'completed'
                    ? 'bg-neutral-800 text-neutral-300'
                    : 'bg-emerald-600/90 text-white'
                }`}>
                  {selectedEvent.status === 'completed' ? 'فعالية سابقة' : 'فعالية قادمة'}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
              <h2 className="text-lg sm:text-2xl font-cairo font-black text-white leading-tight">
                {selectedEvent.title}
              </h2>

              {/* Event Time & Location Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs font-tajawal">
                <div className="flex items-center gap-2 text-neutral-300">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-500">التاريخ</div>
                    <div className="font-bold">{selectedEvent.dateDisplay || 'قريباً'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-neutral-300">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-500">الوقت</div>
                    <div className="font-bold">{selectedEvent.timeDisplay || '09:00 م'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-neutral-300">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <div className="text-[10px] text-neutral-500">المكان</div>
                    <div className="font-bold truncate">{selectedEvent.location || 'المجلس العام'}</div>
                  </div>
                </div>
              </div>

              {/* Full Description */}
              <div className="space-y-2">
                <h4 className="font-cairo font-bold text-sm text-neutral-200">عن الفعالية</h4>
                <p className="text-xs sm:text-sm text-neutral-300 font-tajawal leading-relaxed whitespace-pre-line">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Organizer Info */}
              <div className="p-3.5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-neutral-950 font-black font-cairo shadow-md">
                    👑
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 font-tajawal">الجهة المنظمة</div>
                    <div className="font-cairo font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                      <span>{selectedEvent.creatorName}</span>
                      {isUserOwner({ role: selectedEvent.creatorRole, username: selectedEvent.creatorName }) && (
                        <OwnerBadge size="xs" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left font-tajawal text-xs text-neutral-400">
                  <div>العدد المتاح</div>
                  <div className="font-bold text-indigo-300">{selectedEvent.participantsCount} / {selectedEvent.maxParticipants}</div>
                </div>
              </div>

              {/* Participants Sample List */}
              {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="font-cairo font-bold text-xs sm:text-sm text-neutral-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>المسجلون في الفعالية ({selectedEvent.participants.length})</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.participants.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onOpenProfile && onOpenProfile(p.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-900/80 border border-neutral-800 text-[11px] font-tajawal text-neutral-300 hover:text-white hover:border-neutral-700 cursor-pointer transition-colors"
                      >
                        <div className="w-5 h-5 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center text-[10px]">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={p.username} className="w-full h-full object-cover" />
                          ) : (
                            p.username.slice(0, 1)
                          )}
                        </div>
                        <span>{p.username}</span>
                        {isUserOwner({ role: p.role, username: p.username }) && (
                          <OwnerBadge size="xs" showLabel={false} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:p-5 border-t border-neutral-800/80 bg-[#090b10] flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                إغلاق
              </button>

              {selectedEvent.status !== 'completed' && (
                <button
                  onClick={() => handleToggleJoin(selectedEvent.id)}
                  disabled={joiningEventId === selectedEvent.id}
                  className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-cairo font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    selectedEvent.isJoined
                      ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-600 text-rose-200'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  }`}
                >
                  {selectedEvent.isJoined ? (
                    <>
                      <span>إلغاء التسجيل</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد تسجيل الحضور الآن</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL (Owner & Admin Only) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-lg bg-[#0d0f17] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="font-cairo font-bold text-base text-white">
                  {editingEventId ? 'تعديل الفعالية' : 'إضافة فعالية رسمية جديدة'}
                </h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-tajawal">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateEvent} className="space-y-3.5 text-xs font-tajawal">
              <div>
                <label className="block text-neutral-300 font-bold mb-1">عنوان الفعالية *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: أمسية ديوان الشعر الخليجي"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">التصنيف</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="مجالس شعر وأدب">مجالس شعر وأدب</option>
                    <option value="ألعاب ومسابقات">ألعاب ومسابقات</option>
                    <option value="تطوير ودعم نفسي">تطوير ودعم نفسي</option>
                    <option value="احتفال وتكريم">احتفال وتكريم</option>
                    <option value="قصص وتجارب">قصص وتجارب</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">المكان / الغرفة</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="مثال: المجلس العام (صوتي)"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">التاريخ</label>
                  <input
                    type="text"
                    value={newDateDisplay}
                    onChange={(e) => setNewDateDisplay(e.target.value)}
                    placeholder="مثال: 25 أكتوبر 2026"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">الوقت</label>
                  <input
                    type="text"
                    value={newTimeDisplay}
                    onChange={(e) => setNewTimeDisplay(e.target.value)}
                    placeholder="09:00 م"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">الحد الأقصى للمشاركين</label>
                  <input
                    type="number"
                    value={newMaxParticipants}
                    onChange={(e) => setNewMaxParticipants(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">رابط صورة الغلاف (اختياري)</label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">وصف الفعالية وأهدافها *</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                  placeholder="اكتب تفاصيل الفعالية، فقرات الأمسية، الجوائز أو شروط المشاركة..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-cairo font-bold transition-all shadow-md cursor-pointer"
                >
                  {submitting ? 'جاري الحفظ...' : editingEventId ? 'حفظ التعديلات' : 'نشر الفعالية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
