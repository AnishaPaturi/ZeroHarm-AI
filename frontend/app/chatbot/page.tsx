'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { chatbotService, ChatMessage } from '../../services/chatbot';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const SUGGESTED_PROMPTS = [
    { label: 'OISD Valve Calibration Cycles', query: 'What are the OISD guidelines for relief valve calibration?' },
    { label: 'DGMS Gas Leak Reporting Directives', query: 'How do we report a gas leak under DGMS?' },
    { label: 'Factory Act Standard PPE Checklist', query: 'Show me standard PPE guidelines for working at heights.' }
  ];

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
      const response = await chatbotService.sendMessage(text);
      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        sender: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      addToast('Failed to retrieve response', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Basic custom formatter to render basic markdown elements: headings, tables, blocks, bullet lists
  const formatContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // 1. Alert boxes
      if (line.startsWith('> [!WARNING]')) {
        return (
          <div key={idx} className="my-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 font-medium">
            {line.replace('> [!WARNING]', '⚠️ Warning:')}
          </div>
        );
      }
      if (line.startsWith('> [!TIP]')) {
        return (
          <div key={idx} className="my-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 font-medium">
            {line.replace('> [!TIP]', '💡 Pro Tip:')}
          </div>
        );
      }
      if (line.startsWith('>')) {
        return (
          <blockquote key={idx} className="border-l-2 border-safety-orange pl-3 text-slate-400 italic my-2">
            {line.replace('>', '')}
          </blockquote>
        );
      }

      // 2. Headings
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="font-heading font-bold text-sm text-white mt-4 mb-2 tracking-wide uppercase">
            {line.replace('### ', '')}
          </h3>
        );
      }

      // 3. Table Rows (Simple visual layout for tables)
      if (line.startsWith('|')) {
        if (line.includes('---')) return null; // skip divider lines
        const cells = line.split('|').filter(c => c.trim() !== '');
        return (
          <div key={idx} className="grid grid-cols-3 gap-2.5 border-b border-white/5 py-2 font-mono text-[10px]">
            {cells.map((cell, cIdx) => (
              <span key={cIdx} className="text-slate-300 truncate">{cell.trim()}</span>
            ))}
          </div>
        );
      }

      // 4. Bullet lists
      if (line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-2 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-safety-orange mt-1.5 flex-shrink-0" />
            <span className="text-slate-300">{line.replace('- ', '')}</span>
          </div>
        );
      }
      if (/^\d+\./.test(line)) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-2 my-1">
            <span className="font-bold text-safety-orange flex-shrink-0">{line.match(/^\d+\./)?.[0]}</span>
            <span className="text-slate-300">{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
      }

      // 5. Standard line
      return <p key={idx} className="my-1 text-slate-300 leading-relaxed font-sans">{line}</p>;
    });
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
      <div>
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
          ASSISTANT TERMINAL
        </span>
        <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
          Safety Intelligence Chatbot
        </h1>
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
                  {isUser ? <p>{msg.content}</p> : formatContent(msg.content)}
                  
                  <span className="text-[8px] font-mono text-slate-500 block text-right mt-2 uppercase">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
