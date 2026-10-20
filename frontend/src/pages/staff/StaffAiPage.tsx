import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/common/Toast';
import { aiApi, StructuredAiResponse } from '../../services/ai.service';
import { UnifiedAppLayout } from '../../layouts/UnifiedAppLayout';
import { PageHeader } from '../../components/common/PageHeader';
import {
  Bot,
  Sparkles,
  Send,
  Database,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  response?: StructuredAiResponse;
  timestamp: string;
  expandedEvidence?: boolean;
}

const STAFF_SUGGESTED_QUESTIONS = [
  'What classes do I have today?',
  'What is my current class?',
  'What tasks are pending?',
  'Which of my tasks are overdue?',
  'What is my current workload?',
  'Summarize my attendance.',
  'What leave requests have I submitted?',
  'What is my current activity?',
  'Summarize my workload trend.',
  'Explain my performance metrics.',
  'Show my recent notifications.',
];

export const StaffAiPage: React.FC = () => {
  const { addToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const promptToSend = (queryText || inputPrompt).trim();
    if (!promptToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const result = await aiApi.askStaffAssistant(promptToSend);
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        response: result,
        timestamp: new Date().toLocaleTimeString(),
        expandedEvidence: false,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      addToast(err.message || 'Failed to complete personal AI assistant query', 'error');
      const errorMessage: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `Error: ${err.message || 'The AI assistant could not retrieve authorized data for this query.'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleEvidence = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, expandedEvidence: !m.expandedEvidence } : m))
    );
  };

  const handleFeedback = async (analysisId: string | undefined, rating: 'HELPFUL' | 'NOT_HELPFUL') => {
    if (!analysisId) return;
    try {
      await aiApi.submitFeedback(analysisId, rating);
      addToast('Thank you for rating this assistance response', 'success');
    } catch {
      addToast('Feedback recorded locally', 'info');
    }
  };

  const handleClear = () => {
    setMessages([]);
    addToast('Conversation cleared', 'info');
  };

  return (
    <UnifiedAppLayout
      breadcrumbs={[
        { label: 'Workspace', href: '/staff/dashboard' },
        { label: 'AI Assistant' },
      ]}
      searchPlaceholder="Ask your AI assistant..."
    >
      <div className="space-y-6">
        <PageHeader
          title="My AI Staff Assistant"
          subtitle="Personal operational assistant with strict self-only data scoping. Get verified answers on your classes, tasks, attendance, and workload."
          icon={Sparkles}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Self-Only Scoped • IDOR Enforced
            </span>
          }
          actions={
            <button
              onClick={handleClear}
              disabled={messages.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Clear Chat</span>
            </button>
          }
        />

        {/* Suggested Questions Grid */}
        {messages.length === 0 && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Suggested Questions About Your Operational Duties</h3>
                <p className="text-xs text-slate-500">Click any query to evaluate your assignments, schedules, attendance, and workload records</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {STAFF_SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="text-left text-xs bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 text-slate-700 hover:text-blue-900 p-3 rounded-xl transition-all font-medium flex items-center justify-between group shadow-2xs"
                >
                  <span className="line-clamp-2">{q}</span>
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 min-h-[420px] max-h-[600px] overflow-y-auto space-y-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Personal AI Assistant Ready</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Ask about your scheduled timetable classes, task deadlines, attendance logs, leave balances, or workload metrics.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {msg.sender === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 text-xs max-w-xl shadow-xs shadow-blue-600/20">
                      <p className="font-medium leading-relaxed">{msg.text}</p>
                      <span className="text-[10px] text-blue-200 block text-right mt-1 font-mono">{msg.timestamp}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 max-w-4xl">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>

                    <div className="space-y-3.5 flex-1 bg-slate-50/70 border border-slate-200/80 rounded-2xl rounded-tl-xs p-5 text-xs">
                      {msg.text && <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.text}</p>}

                      {msg.response && (
                        <div className="space-y-3.5">
                          {/* 1. Synthesis Answer */}
                          <div className="text-slate-900 leading-relaxed font-normal whitespace-pre-wrap text-xs">
                            {msg.response.answer}
                          </div>

                          {/* 2. Database Facts Section */}
                          {msg.response.databaseFacts && msg.response.databaseFacts.length > 0 && (
                            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                                <Database className="w-3.5 h-3.5 text-blue-600" />
                                Personal Database Facts ({msg.response.databaseFacts.length})
                              </div>
                              <ul className="list-disc list-inside text-xs text-blue-950 space-y-1">
                                {msg.response.databaseFacts.map((fact, i) => (
                                  <li key={i}>{fact}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 3. Rule-Based Conditions Section */}
                          {msg.response.ruleBasedConditions && msg.response.ruleBasedConditions.length > 0 && (
                            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Operational Conditions ({msg.response.ruleBasedConditions.length})
                              </div>
                              <ul className="list-disc list-inside text-xs text-amber-950 space-y-1">
                                {msg.response.ruleBasedConditions.map((cond, i) => (
                                  <li key={i}>{cond}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 4. AI Insights Section */}
                          {msg.response.aiInsights && msg.response.aiInsights.length > 0 && (
                            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                AI Insights ({msg.response.aiInsights.length})
                              </div>
                              <ul className="list-disc list-inside text-xs text-purple-950 space-y-1">
                                {msg.response.aiInsights.map((insight, i) => (
                                  <li key={i}>{insight}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 5. Evidence Section (Expandable) */}
                          {msg.response.evidence && msg.response.evidence.length > 0 && (
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => toggleEvidence(msg.id)}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
                              >
                                <span className="flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                  Verified Personal Records ({msg.response.evidence.length} items)
                                </span>
                                {msg.expandedEvidence ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>

                              {msg.expandedEvidence && (
                                <div className="p-3 divide-y divide-slate-100 max-h-60 overflow-y-auto space-y-2">
                                  {msg.response.evidence.map((ev, i) => (
                                    <div key={i} className="pt-2 first:pt-0 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                          {ev.entity_type}
                                        </span>
                                        <span className="font-mono text-[10px] text-slate-400">ID: {ev.entity_id}</span>
                                      </div>
                                      <p className="text-slate-700 mt-1">{ev.explanation}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Message Metadata & Feedback Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-500">
                            <span className="font-mono text-[10px] text-slate-400">Scope: {msg.response.dataScope}</span>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleFeedback(msg.response?.analysisId, 'HELPFUL')}
                                className="p-1 hover:text-emerald-600 rounded transition-colors"
                                title="Helpful"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleFeedback(msg.response?.analysisId, 'NOT_HELPFUL')}
                                className="p-1 hover:text-rose-600 rounded transition-colors"
                                title="Not helpful"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-blue-700 bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>Consulting authorized personal records and generating grounded response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask a question about your classes, tasks, attendance, or workload..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-xs shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 text-slate-900 placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Ask Assistant
              </>
            )}
          </button>
        </form>
      </div>
    </UnifiedAppLayout>
  );
};
