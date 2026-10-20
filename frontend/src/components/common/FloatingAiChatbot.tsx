import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aiApi, StructuredAiResponse } from '../../services/ai.service';
import {
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
  Database,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  response?: StructuredAiResponse;
  timestamp: string;
  isError?: boolean;
  expandedEvidence?: boolean;
}

export const FloatingAiChatbot: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Restore conversation from sessionStorage if present
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`floating_chat_${user?.id || 'guest'}`);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        // Initial welcome message
        const welcomeMessage: ChatMessage = {
          id: 'welcome-msg',
          sender: 'ai',
          text: isAdmin
            ? `Hello ${user?.fullName || 'Administrator'}. I am your Universal Operations Intelligence Assistant. Ask me anything about staff profiles, timetables, live coverage, attendance, tasks, leaves, reports, audit logs, or general queries in English, Tamil, or Tanglish.`
            : `Hello ${user?.fullName || 'Faculty Member'}. I am your Operations Assistant. Ask me about your assigned timetable, classes, tasks, leaves, workload, or general technical questions.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([welcomeMessage]);
      }
    } catch {
      // Ignore session storage errors
    }
  }, [user?.id, isAdmin, user?.fullName]);

  // Persist conversation to sessionStorage
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      try {
        sessionStorage.setItem(`floating_chat_${user.id}`, JSON.stringify(messages));
      } catch {
        // Ignore quota errors
      }
    }
  }, [messages, user?.id]);

  // Scroll to bottom on message updates
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen, isMinimized]);

  // Focus input on panel open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || inputPrompt).trim();
    if (!promptToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);
    setLastFailedPrompt(null);

    // Format conversation history for contextual follow-ups
    const conversationHistory = messages
      .filter((m) => m.text || m.response?.answer)
      .slice(-6)
      .map((m) => ({
        sender: m.sender,
        text: m.text || m.response?.answer || '',
      }));

    try {
      const result = isAdmin
        ? await aiApi.askAdminCopilot(promptToSend, conversationHistory)
        : await aiApi.askStaffAssistant(promptToSend, conversationHistory);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        response: result,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        expandedEvidence: false,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setLastFailedPrompt(promptToSend);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Error: ${err.message || 'The operations assistant could not process your query.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      sender: 'ai',
      text: isAdmin
        ? `New session started. How can I assist with institutional operations or general technical questions today?`
        : `New session started. Ask me about your timetable, classes, tasks, or general questions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMessage]);
    setLastFailedPrompt(null);
    if (user?.id) {
      sessionStorage.removeItem(`floating_chat_${user.id}`);
    }
  };

  const toggleEvidence = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, expandedEvidence: !m.expandedEvidence } : m))
    );
  };

  if (!user) return null;

  return (
    <aside
      aria-label="AI Operations Chatbot"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-none select-none"
    >
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chatbot-header-title"
          className={`pointer-events-auto w-[calc(100vw-2rem)] sm:w-[420px] md:w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-200 mb-3 ${
            isMinimized ? 'h-14' : 'h-[580px] max-h-[calc(100vh-6.5rem)]'
          }`}
          style={{
            boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.25), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white px-4 py-3 flex items-center justify-between border-b border-indigo-900/50 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 p-1 flex items-center justify-center border border-white/20 shrink-0 shadow-xs">
                <img
                  src="/assets/branding/logo-emblem.png"
                  alt="Official Logo Emblem"
                  className="w-full h-full object-contain"
                  loading="eager"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2
                    id="chatbot-header-title"
                    className="text-xs font-bold text-white tracking-tight truncate"
                  >
                    AI Operations Copilot
                  </h2>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {isAdmin ? 'Admin' : 'Staff'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-300 truncate font-normal">
                  Universal Operations Intelligence
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 text-slate-300">
              <button
                type="button"
                onClick={handleNewChat}
                title="Start New Chat"
                aria-label="Start New Chat"
                className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand Chat' : 'Minimize Chat'}
                aria-label={isMinimized ? 'Expand Chat' : 'Minimize Chat'}
                className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Chat"
                aria-label="Close Chat"
                className="p-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-200 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              {/* Message Feed */}
              <div
                tabIndex={0}
                aria-label="Conversation Messages"
                className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/70 select-text focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500/20"
              >
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : msg.isError
                            ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-bl-xs'
                            : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                        }`}
                      >
                        {/* Normal text or error */}
                        {msg.text && (
                          <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                        )}

                        {/* Structured AI Response */}
                        {msg.response && (
                          <div className="space-y-2.5">
                            {/* Formatted Answer */}
                            <div className="prose prose-xs max-w-none text-slate-800 font-sans whitespace-pre-wrap">
                              {msg.response.answer}
                            </div>

                            {/* Database Facts Pill / Evidence toggle */}
                            {msg.response.databaseFacts?.length > 0 && (
                              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                                  <Database className="w-3 h-3 text-blue-600" />
                                  {msg.response.databaseFacts.length} verified facts
                                </span>
                                {msg.response.evidence?.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleEvidence(msg.id)}
                                    className="text-[10px] text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-0.5"
                                  >
                                    <span>{msg.expandedEvidence ? 'Hide Evidence' : 'Show Evidence'}</span>
                                    {msg.expandedEvidence ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Expanded Evidence Drawer */}
                            {msg.expandedEvidence && msg.response.evidence && (
                              <div className="mt-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[10px] text-slate-600 font-mono">
                                <div className="font-bold text-slate-700 text-[10px] uppercase font-sans">
                                  PostgreSQL Audit Grounding
                                </div>
                                {msg.response.evidence.slice(0, 5).map((ev, i) => (
                                  <div key={i} className="border-l-2 border-blue-400 pl-1.5 py-0.5">
                                    <span className="font-semibold text-blue-700">[{ev.entity_type}]</span>{' '}
                                    {ev.explanation}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timestamp & Retry button if error */}
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                        {msg.isError && lastFailedPrompt && (
                          <button
                            type="button"
                            onClick={() => handleSend(lastFailedPrompt)}
                            className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 underline"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Loading state indicator */}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl rounded-bl-xs p-3 w-fit shadow-xs animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                    <span>Retrieving authorized institutional records...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-end gap-2"
                >
                  <div className="relative flex-1">
                    <textarea
                      ref={inputRef}
                      value={inputPrompt}
                      onChange={(e) => setInputPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about staff, timetable, tasks, or in Tamil/Tanglish..."
                      aria-label="Type your message"
                      rows={1}
                      disabled={loading}
                      className="w-full text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none max-h-24 min-h-[38px] leading-relaxed transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() || loading}
                    aria-label="Send message"
                    className="h-[38px] px-3.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
                <div className="flex items-center justify-between mt-1.5 px-0.5 text-[10px] text-slate-400">
                  <span>Enter to send • Shift+Enter for new line</span>
                  <span className="text-blue-600 font-medium">English, தமிழ் & Tanglish</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Assistant Button: Always visible on supported dashboard pages */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (isMinimized) setIsMinimized(false);
        }}
        aria-label="Open AI Operations Assistant"
        title="AI Operations Intelligence Assistant"
        className="pointer-events-auto group relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white shadow-xl hover:shadow-2xl border-2 border-indigo-600/90 p-2 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-400/50"
        style={{
          boxShadow: '0 8px 24px -4px rgba(30, 58, 138, 0.35), 0 0 0 1px rgba(30, 58, 138, 0.1)',
        }}
      >
        <img
          src="/assets/branding/logo-emblem.png"
          alt="AI Operations Intelligence Logo"
          className="w-full h-full object-contain select-none transition-transform duration-200 group-hover:scale-105"
          loading="eager"
        />

        {/* Online Status Badge */}
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-xs">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-75" />
        </span>
      </button>
    </aside>
  );
};
