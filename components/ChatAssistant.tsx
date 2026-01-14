
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GenieFeedback } from '../types';
import { streamChatResponse, streamOpenAIResponse } from '../services/geminiService';

// --- Grounding Sources Component ---
const GroundingSources = ({ metadata }: { metadata: any }) => {
  if (!metadata?.groundingChunks || metadata.groundingChunks.length === 0) return null;
  
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
        Verified Intelligence Sources
      </span>
      <div className="flex flex-wrap gap-2">
        {metadata.groundingChunks.map((chunk: any, idx: number) => {
          if (chunk.web) {
            return (
               <a key={idx} href={chunk.web.uri} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-100 px-3 py-2 rounded-xl transition-all font-bold max-w-xs truncate shadow-sm group">
                 <span className="truncate">{chunk.web.title}</span>
                 <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
               </a>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// --- Feedback Form Component ---
const FeedbackForm = ({ onClose, lastUserMsg, lastModelMsg }: { onClose: () => void, lastUserMsg?: string, lastModelMsg?: string }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = () => {
    const feedback: GenieFeedback = {
      id: Date.now().toString(),
      rating,
      comment,
      timestamp: Date.now(),
      querySnippet: lastUserMsg?.substring(0, 200) || 'Unknown',
      responseSnippet: lastModelMsg?.substring(0, 200) || 'Unknown',
      topic: lastUserMsg?.toLowerCase().includes('gmp') ? 'GMP' : lastUserMsg?.toLowerCase().includes('gcp') ? 'GCP' : 'PV'
    };

    try {
      const stored = localStorage.getItem('aide_genie_feedback');
      const existing = stored ? JSON.parse(stored) : [];
      localStorage.setItem('aide_genie_feedback', JSON.stringify([...existing, feedback]));
    } catch (e) {
      console.error("Failed to save feedback", e);
    }

    setIsSubmitted(true);
    setTimeout(onClose, 2500);
  };

  if (isSubmitted) {
    return (
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center animate-in fade-in zoom-in duration-300 border border-slate-100">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Feedback Recorded</h3>
            <p className="text-sm text-slate-500">Your input helps GxP Genie learn and improve regulatory precision.</p>
        </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                Rate Intelligence Accuracy
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <div className="p-6 space-y-6">
            <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase">How helpful was this response?</span>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className="focus:outline-none transition-all duration-200 hover:scale-110 active:scale-95"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(star)}
                        >
                            <svg 
                                className={`w-10 h-10 ${star <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                                viewBox="0 0 24 24" 
                                stroke="currentColor" 
                                strokeWidth={star <= (hoverRating || rating) ? "0" : "1.5"}
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </button>
                    ))}
                </div>
            </div>
            
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Context for system learning</label>
                <textarea
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 min-h-[120px] resize-none bg-slate-50 transition-all shadow-inner"
                    placeholder="E.g. specific citation errors, missing guidelines, or tone feedback..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                ></textarea>
            </div>

            <button
                onClick={handleSubmit}
                disabled={rating === 0}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-black disabled:opacity-30 transition-all shadow-lg text-xs uppercase tracking-widest"
            >
                Submit Performance Data
            </button>
        </div>
    </div>
  );
}

interface ChatAssistantProps {
    openaiKey?: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ openaiKey: propOpenaiKey }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: 'Welcome to GxP Genie. I provide real-time regulatory intelligence and GxP compliance advice with cited source references. How can I assist with your GMP, GCP, or PV queries today?', timestamp: Date.now() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [showKnowledgeBank, setShowKnowledgeBank] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openai'>('gemini');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openaiKey = propOpenaiKey || process.env.openai_api_key;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setActiveProvider('gemini');

    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() }]);
    
    let fullText = '';
    let accumulatedMetadata: any = null;

    try {
      await streamChatResponse(history, userMsg.text, (chunk, metadata) => {
        fullText += chunk;
        if (metadata) accumulatedMetadata = metadata;
        setMessages(prev => prev.map(m => 
          m.id === modelMsgId ? { ...m, text: fullText, groundingMetadata: accumulatedMetadata } : m
        ));
      });
    } catch (geminiError: any) {
      if (openaiKey) {
        setActiveProvider('openai');
        let fallbackFullText = `[PRIMARY ENGINE LOAD LIMIT REACHED - SWITCHING TO SECONDARY]\n\n`;
        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: fallbackFullText } : m));
        try {
          await streamOpenAIResponse(history, userMsg.text, openaiKey, (chunk) => {
            fallbackFullText += chunk;
            setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: fallbackFullText } : m));
          });
        } catch (openaiError: any) {
          setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: `System connection error. Please retry.` } : m));
        }
      } else {
        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: `GxP Genie is currently unavailable.` } : m));
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getLastUserMsg = () => {
    const userMsgs = messages.filter(m => m.role === 'user');
    return userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].text : undefined;
  };

  const getLastModelMsg = () => {
    const modelMsgs = messages.filter(m => m.role === 'model');
    return modelMsgs.length > 0 ? modelMsgs[modelMsgs.length - 1].text : undefined;
  };

  const KNOWLEDGE_SOURCES = [
      { name: 'FDA Newsroom', url: 'https://www.fda.gov/news-events', icon: '🇺🇸' },
      { name: 'EMA Announcements', url: 'https://www.ema.europa.eu/en/news', icon: '🇪🇺' },
      { name: 'MHRA Regulatory Updates', url: 'https://www.gov.uk/mhra/news', icon: '🇬🇧' },
      { name: 'ICH Official Library', url: 'https://www.ich.org/library', icon: '🌐' },
      { name: 'GxP Ingested Bank', url: '/#/database', icon: '📁' }
  ];

  return (
    <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative min-h-0">
      {/* Integrated Knowledge Hub Header */}
      <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-3xl rounded-full -mr-32 -mt-32"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                      <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                  </div>
                  <div>
                      <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                          Knowledge Intelligence Hub
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black bg-cyan-500 text-slate-900 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">Sync Active</span>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Authorized Internal & External Banks</p>
                      </div>
                  </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                  <button 
                      onClick={() => (window as any).setActiveTab?.('gap-analysis')}
                      className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 border-b-4 border-slate-300 hover:bg-slate-50"
                  >
                      <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                      Ingest SOPs
                  </button>
                  <a 
                      href="https://sharepoint.com/sites/clinical-knowledge-base" 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-black text-xs border border-white/10 transition-all shadow-lg active:scale-95"
                  >
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M1.3 0H24v24H0V1.3L1.3 0zm10.5 20.3V3.7l-7.9 4.3v8l7.9 4.3zm9 0V3.7l-7.9 4.3v8l7.9 4.3z"/></svg>
                      SharePoint
                  </a>
                  <button 
                      onClick={() => setShowKnowledgeBank(!showKnowledgeBank)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 border border-white/20 ${showKnowledgeBank ? 'bg-cyan-500 text-slate-900' : 'bg-slate-800 text-white'}`}
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                      Bank Sources
                  </button>
              </div>
          </div>

          {/* Expanded Bank Sources Overlay */}
          {showKnowledgeBank && (
              <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 animate-in slide-in-from-top duration-300">
                  <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3">Live Linked Registries</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {KNOWLEDGE_SOURCES.map((source, i) => (
                          <a key={i} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-black/20 hover:bg-black/40 rounded-xl transition-all border border-white/5 group">
                              <span className="text-lg">{source.icon}</span>
                              <span className="text-[10px] font-bold text-slate-300 group-hover:text-white truncate">{source.name}</span>
                          </a>
                      ))}
                  </div>
              </div>
          )}
      </div>

      <div className="px-5 py-3 border-b border-slate-100 bg-white flex justify-between items-center z-10 shadow-sm">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px] ${activeProvider === 'gemini' ? 'bg-cyan-500 shadow-cyan-400' : 'bg-green-500 shadow-green-400'}`}></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Genie Intelligence Active</span>
              </div>
          </div>
          <button 
            onClick={() => setIsFeedbackOpen(true)} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-100 transition-all active:scale-95 shadow-sm uppercase tracking-tighter"
          >
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
              Rate Precision
          </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
        {messages.map((message, index) => (
          <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {message.role === 'model' && (
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 bg-slate-900 flex items-center justify-center text-white border border-slate-700">
                <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" /></svg>
              </div>
            )}
            <div className={`max-w-2xl p-6 rounded-3xl shadow-sm ${
                message.role === 'user'
                  ? 'bg-slate-800 text-white rounded-br-none'
                  : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
              }`}
            >
              <div className="whitespace-pre-wrap text-[13px] leading-[1.8] font-medium tracking-tight">
                {message.text}
                {isTyping && index === messages.length - 1 && (
                  <span className="ml-1 inline-flex w-1.5 h-4 bg-cyan-500 animate-pulse"></span>
                )}
              </div>
              {message.groundingMetadata && <GroundingSources metadata={message.groundingMetadata} />}
            </div>
            {message.role === 'user' && (
              <div className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex-shrink-0 flex items-center justify-center">
                 <span className="text-slate-600 font-black text-[10px]">YOU</span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-5 border-t border-slate-100 bg-white z-10 shadow-sm">
        <div className="relative max-w-4xl mx-auto">
          <textarea
            className="w-full pl-6 pr-14 py-4 border border-slate-200 rounded-3xl resize-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all bg-slate-50 text-[13px] shadow-inner font-bold"
            placeholder="Query GxP Knowledge Bank or Ingested SOPs..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={isTyping || !inputValue.trim()}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-11 h-11 rounded-full flex items-center justify-center hover:bg-black disabled:opacity-30 transition-all shadow-lg active:scale-95 border-b-2 border-cyan-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-widest">
            Specialized in GxP, Clinical Operations & PV Compliance Intelligence
        </p>
      </div>

      {isFeedbackOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
              <FeedbackForm 
                onClose={() => setIsFeedbackOpen(false)} 
                lastUserMsg={getLastUserMsg()}
                lastModelMsg={getLastModelMsg()}
              />
          </div>
      )}
    </div>
  );
};

export default ChatAssistant;
