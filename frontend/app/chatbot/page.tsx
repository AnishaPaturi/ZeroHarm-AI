'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { chatbotService, ChatMessage } from '../../services/chatbot';
import { fetchBackend } from '../../services/api';
import MarkdownRenderer from '../../component/MarkdownRenderer';
import { 
  Send, 
  Sparkles, 
  Cpu, 
  HelpCircle,
  MessageSquare,
  Bot,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatbotPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useNotifications();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content: `### Welcome to ZeroHarm Safety Intelligence Assistant

I am connected to the refinery safety database (OISD, DGMS, Factory Act manual). You can query procedures, compliance rules, or safety guidelines.

Try asking one of the suggested prompts below to start:`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [queryMode, setQueryMode] = useState<'rag' | 'db'>('rag');
  const scrollRef = useRef<HTMLDivElement>(null);

  const SUGGESTED_PROMPTS = [
    { label: 'OISD Valve Calibration Cycles', query: 'What are the OISD guidelines for relief valve calibration?' },
    { label: 'DGMS Gas Leak Reporting Directives', query: 'How do we report a gas leak under DGMS?' },
    { label: 'Factory Act Standard PPE Checklist', query: 'Show me standard PPE guidelines for working at heights.' }
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      if (queryMode === 'db') {
        const response = await fetchBackend<any>(`/api/query/natural-language?query=${encodeURIComponent(text)}`, {
          method: 'POST',
        });
        
        let md = `### 📊 Database Query Results (Innovation 17)\n\n`;
        md += `**Query Filters parsed:** Permit Type: \`${response.parsed_filters?.permit_type}\` | Gas check: \`${response.parsed_filters?.environmental_check}\` | Overlaps: \`${response.parsed_filters?.maintenance_overlap ? 'Yes' : 'No'}\`\n\n`;
        md += `**Matches Found:** \`${response.matches_count}\` incident logs, \`${response.permits_count}\` active permit logs.\n\n`;
        
        if (response.matching_incidents?.length > 0) {
          md += `| DATE | ZONE | RISK SCORE | FACTORS |\n`;
          md += `|---|---|---|---|\n`;
          response.matching_incidents.forEach((inc: any) => {
            md += `| ${inc.date} | ${inc.zone} | ${inc.risk_score}% | ${inc.factors?.slice(0, 2).join(', ')} |\n`;
          });
          md += `\n`;
        } else {
          md += `*No historical safety breaches found matching filters.*\n\n`;
        }

        md += `### 💡 AI Recommendations\n`;
        response.recommendations?.forEach((rec: string) => {
          md += `- ${rec}\n`;
        });

        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          sender: 'assistant',
          content: md,
          timestamp: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const response = await chatbotService.sendMessage(text);
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          sender: 'assistant',
          content: response.answer,
          sources: response.sources,
          mode: response.mode,
          timestamp: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      addToast('Failed to retrieve response', 'error');
    } finally {
      setLoading(false);
    }
  };



  if (authLoading) {
    return (
      <div className="flex flex-col gap-6 py-8 animate-pulse">
        <div className="h-10 bg-white/5 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-safety-orange mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-heading text-lg font-bold text-white mb-2">Gatehouse Verification Required</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          You must log into the platform gateway to access the Safety Intelligence Chatbot.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="bg-safety-orange text-white font-semibold text-xs px-6 py-2.5 rounded-xl hover:bg-safety-orange/90 transition-colors cursor-pointer"
        >
          Proceed to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4 h-[82vh]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
            ASSISTANT TERMINAL
          </span>
          <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
            Safety Intelligence Chatbot
          </h1>
        </div>
        <div className="flex gap-2 bg-white/5 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setQueryMode('rag')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider transition-all uppercase cursor-pointer border-0 ${
              queryMode === 'rag' ? 'bg-safety-orange text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'
            }`}
          >
            RAG Audit Manuals
          </button>
          <button
            onClick={() => setQueryMode('db')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider transition-all uppercase cursor-pointer border-0 ${
              queryMode === 'db' ? 'bg-safety-orange text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'
            }`}
          >
            NLP Database Query (Innovation 17)
          </button>
        </div>
      </div>

      {/* Main Terminal Shell */}
      <div className="flex-1 glass-panel border border-white/10 rounded-3xl overflow-hidden flex flex-col items-stretch relative">
        
        {/* Glow light */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-brand-accentBlue/5 blur-3xl pointer-events-none" />

        {/* Scroll Box */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white ${
                  isUser ? 'bg-gradient-to-tr from-brand-accentBlue to-indigo-500' : 'bg-slate-900 border border-white/10 text-safety-orange'
                }`}>
                  {isUser ? 'U' : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div className={`p-4 rounded-2xl text-xs relative ${
                  isUser 
                    ? 'bg-safety-orange text-white border-l-4 border-l-amber-500 rounded-tr-none' 
                    : 'bg-black/35 border border-white/5 text-slate-300 rounded-tl-none'
                }`}>
                  {!isUser && msg.mode && (
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wide mb-2 uppercase ${
                      msg.mode.includes('Active') 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                        : msg.mode.includes('Failed')
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    }`}>
                      {msg.mode}
                    </span>
                  )}

                  {isUser ? <p className="whitespace-pre-wrap">{msg.content}</p> : <MarkdownRenderer content={msg.content} />}
                  
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/5">
                      <span className="text-[8px] font-mono text-slate-500 block uppercase mb-1.5 tracking-wider">📚 Verified Reference Sources:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, sidx) => (
                          <div 
                            key={sidx} 
                            className="bg-white/5 border border-white/5 rounded px-2 py-1 text-[9px] font-mono text-slate-300 flex items-center gap-1 hover:bg-white/10 transition-colors"
                            title={`Document: ${src.title} | Source: ${src.source} | Score: ${(src.score * 100).toFixed(0)}%`}
                          >
                            <span className="w-1 h-1 rounded-full bg-safety-orange/70" />
                            <span className="truncate max-w-[150px]">{src.title}</span>
                            <span className="text-slate-500">({(src.score * 100).toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className="text-[8px] font-mono text-slate-500 block text-right mt-2 uppercase">
                    {mounted 
                      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex gap-3 self-start max-w-[80%]">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center text-safety-orange">
                <Cpu className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-black/35 border border-white/5 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Suggested Prompts Shelf (only visible when prompt list isn't cluttered) */}
        <div className="px-6 py-3 bg-black/25 border-t border-white/5 flex gap-2.5 overflow-x-auto select-none">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt.query)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white font-semibold text-[10px] whitespace-nowrap transition-all focus:outline-none flex-shrink-0 cursor-pointer"
            >
              {prompt.label}
            </button>
          ))}
        </div>

        {/* Input Dock */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5 flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(inputText); }}
            placeholder="Type a compliance query, e.g. 'What are the OISD safety valve calibration rules?'"
            className="flex-1 bg-black/45 border border-white/10 rounded-2xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-safety-orange focus:ring-1 focus:ring-safety-orange/40 transition-all font-mono"
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            className="bg-safety-orange hover:bg-safety-orange/90 text-white p-3 rounded-2xl shadow-md border border-white/5 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
}
