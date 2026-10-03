import React, { useState, useRef, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Sparkles, X, Send, HelpCircle, ShieldCheck, MessageCircle } from 'lucide-react';

interface FadfadaAssistantModalProps {
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

export const FadfadaAssistantModal: React.FC<FadfadaAssistantModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      sender: 'assistant',
      text: `مرحباً بك يا ${user?.username || 'صديقنا العزيز'}! أنا "مساعد فضفضه" الذكي. أنا هنا لإرشادك والإجابة عن أي استفسار حول كيفية استخدام المنصة (المتصلون الآن، المجالس، المحادثات الخاصة، الصور ذاتية التدمير، المهام، ونظام VIP). كيف يمكنني مساعدتك؟`
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const endRef = useRef<HTMLDivElement>(null);

  const QUICK_QUESTIONS = [
    'كيف يتم ترتيب المتصلين الآن؟',
    'ما هي ميزة الصور ذاتية التدمير؟',
    'كيف أكسب كوينز في فضفضه؟',
    'ما هي قيود حساب الزائر؟',
    'كيف أبلغ عن شخص مخالف؟'
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const res = await apiRequest('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: textToSend,
          username: user?.username,
          isGuest: user?.isGuest
        })
      });

      const assistantMsg: ChatMessage = {
        id: 'ast_' + Date.now(),
        sender: 'assistant',
        text: res.reply
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: 'أعتذر، حدث اضطراب في الاتصال. يمكنك سؤالي عن أي ميزة في فضفضه مجدداً!'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg h-[88dvh] sm:h-[80vh] bg-[#0c0e16] border border-neutral-800 rounded-2xl sm:rounded-3xl flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Assistant Header */}
        <div className="p-3 sm:p-4 border-b border-neutral-800/80 bg-[#080a10] flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-cairo font-bold text-sm sm:text-base text-white flex items-center gap-1.5 sm:gap-2 truncate">
                <span>مساعد فضفضه</span>
                <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal shrink-0">
                  دليل إرشادي
                </span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 font-tajawal truncate">مساعدك الذكي للإجابة عن أسئلة المنصة</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[88%] font-tajawal ${
                  m.sender === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-none'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none shadow-md'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-tajawal animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span>مساعد فضفضه يكتب لك الإجابة...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick Question Chips */}
        <div className="px-4 py-2 bg-neutral-950/60 border-t border-neutral-900 overflow-x-auto flex items-center gap-2 text-xs shrink-0">
          <span className="text-[11px] text-neutral-500 shrink-0 font-tajawal">أسئلة شائعة:</span>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 whitespace-nowrap text-[11px] cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-2.5 sm:p-4 border-t border-neutral-800/80 bg-[#080a10]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل مساعد فضفضه عن أي شيء في المنصة..."
              className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0 active:scale-95"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
