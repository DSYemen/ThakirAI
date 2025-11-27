
import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Bot, Search as SearchIcon, Calendar, ArrowUpRight, Play, Video, Image as ImageIcon, FileText, X, ChevronDown, ChevronUp, Clock, Trash2, History, Mic, MicOff, AlignRight, LayoutList, ExternalLink, Loader2, Hash, ArrowUpLeft } from 'lucide-react';
import { getMemories, getAllTags } from '../services/db';
import { smartSearch } from '../services/geminiService';
import { getSettings } from '../services/settingsService';
import { MediaType, SearchResult, MemoryItem } from '../types';

interface SearchViewProps {
  onJumpToMemory: (id: string) => void;
}

interface Suggestion {
  text: string;
  type: 'history' | 'tag';
}

export const SearchView: React.FC<SearchViewProps> = ({ onJumpToMemory }) => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [language, setLanguage] = useState('ar-SA');
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
      const h = localStorage.getItem('thakira_search_history'); 
      if (h) setSearchHistory(JSON.parse(h)); 
      
      const settings = getSettings();
      setLanguage(settings.language || 'ar-SA');

      getAllTags().then(setPopularTags);
  }, []);

  const saveToHistory = (q: string) => { const trim = q.trim(); if(!trim) return; const up = [trim, ...searchHistory.filter(h => h !== trim)].slice(0, 10); setSearchHistory(up); localStorage.setItem('thakira_search_history', JSON.stringify(up)); };
  const deleteFromHistory = (e: React.MouseEvent, i: string) => { e.stopPropagation(); const up = searchHistory.filter(item => item !== i); setSearchHistory(up); localStorage.setItem('thakira_search_history', JSON.stringify(up)); };
  const clearHistory = () => { if (confirm("مسح السجل؟")) { setSearchHistory([]); localStorage.removeItem('thakira_search_history'); } };

  const updateSuggestions = (val: string) => {
      if (!val.trim()) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
      }
      
      const lower = val.toLowerCase();
      const histMatches: Suggestion[] = searchHistory
          .filter(h => h.toLowerCase().includes(lower))
          .slice(0, 3)
          .map(h => ({ text: h, type: 'history' }));
      
      const tagMatches: Suggestion[] = popularTags
          .filter(t => t.toLowerCase().includes(lower) && !histMatches.some(h => h.text === t))
          .slice(0, 5)
          .map(t => ({ text: t, type: 'tag' }));
      
      const combined = [...histMatches, ...tagMatches];
      setSuggestions(combined);
      setShowSuggestions(combined.length > 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      updateSuggestions(val);
  };

  const handleSuggestionClick = (suggestion: string) => {
      setQuery(suggestion);
      setShowSuggestions(false);
      handleSearch(undefined, suggestion);
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault(); const text = overrideQuery || query; if (!text.trim()) return;
    if (overrideQuery) setQuery(overrideQuery); 
    setShowSuggestions(false);
    setIsSearching(true); setResponse(""); setResults([]); setExpandedId(null); saveToHistory(text);
    try {
      const memories = await getMemories(); const recent = memories.slice(0, 50);
      const { answer, results: raw } = await smartSearch(text, recent);
      setResponse(answer);
      const mapped = raw.map(r => { const item = memories.find(m => m.id === r.id); return item ? { item, score: r.score, relevanceReason: r.reason } : null; }).filter(Boolean) as SearchResult[];
      setResults(mapped);
    } catch (err) { setResponse("خطأ في الاتصال."); } finally { setIsSearching(false); }
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return alert("غير مدعوم");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition(); 
    rec.lang = language; 
    rec.interimResults = false; 
    rec.maxAlternatives = 1;
    rec.onstart = () => setIsListening(true); 
    rec.onend = () => setIsListening(false);
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; if (t) { setQuery(t); handleSearch(undefined, t); } };
    rec.start();
  };

  const getIcon = (type: MediaType) => { switch(type) { case MediaType.AUDIO: return <Play size={16} />; case MediaType.VIDEO: return <Video size={16} />; case MediaType.IMAGE: return <ImageIcon size={16} />; default: return <FileText size={16} />; } };
  const getStyles = (type: MediaType) => { switch(type) { case MediaType.AUDIO: return {t:'text-blue-500', b:'bg-blue-50 dark:bg-blue-500/10'}; case MediaType.VIDEO: return {t:'text-red-500', b:'bg-red-50 dark:bg-red-500/10'}; case MediaType.IMAGE: return {t:'text-purple-500', b:'bg-purple-50 dark:bg-purple-500/10'}; default: return {t:'text-green-500', b:'bg-green-50 dark:bg-green-500/10'}; } };

  return (
    <div className="flex flex-col h-full bg-dark relative">
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col items-center pb-32">
        {!response && !isSearching && (
            <div className="mt-8 w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <div className="inline-block p-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-200 dark:border-white/5 shadow-xl">
                        <Sparkles size={32} className="text-purple-500 dark:text-purple-300" />
                    </div>
                    <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-400">المساعد الذكي</h2>
                </div>
                {searchHistory.length > 0 && (
                    <div className="w-full">
                         <div className="flex items-center justify-between mb-3 px-2">
                            <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><History size={14} /> سجل البحث</h3>
                            <button onClick={clearHistory} className="text-[10px] text-red-500/70 hover:text-red-500">مسح الكل</button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {searchHistory.map((item, i) => (
                                <div key={i} onClick={() => handleSearch(undefined, item)} className="group flex items-center justify-between bg-white dark:bg-card border border-gray-200 dark:border-white/5 p-3 rounded-xl cursor-pointer transition-colors shadow-sm">
                                    <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"><Clock size={14} className="text-gray-400" /><span className="line-clamp-1">{item}</span></div>
                                    <button onClick={(e) => deleteFromHistory(e, item)} className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {isSearching && <div className="flex flex-col items-center gap-4 mt-20"><Loader2 size={40} className="animate-spin text-primary" /><p className="text-sm text-gray-500 animate-pulse">جاري البحث...</p></div>}

        {(response || results.length > 0) && !isSearching && (
            <div className="w-full max-w-md animate-in slide-in-from-bottom-2 space-y-6">
                {response && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-2 text-primary text-xs font-bold uppercase tracking-wider"><AlignRight size={14} /><span>الإجابة</span></div>
                        <div className="bg-white dark:bg-card border border-primary/20 p-5 rounded-2xl shadow-lg text-sm text-foreground leading-relaxed ring-1 ring-primary/10 relative">
                            {response}
                            <div className="absolute -top-3 -right-3 bg-gradient-to-br from-primary to-secondary p-1.5 rounded-full shadow-lg"><Bot size={16} className="text-white" /></div>
                        </div>
                    </div>
                )}
                {results.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-2"><h3 className="text-xs font-bold text-gray-500 flex items-center gap-2"><LayoutList size={14} /> المصادر ({results.length})</h3></div>
                        {results.map((res) => {
                            const isExpanded = expandedId === res.item.id;
                            const st = getStyles(res.item.type);
                            return (
                                <div key={res.item.id} onClick={() => setExpandedId(isExpanded ? null : res.item.id)} className={`bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden transition-all shadow-sm ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}>
                                    <div className="p-3 flex gap-3">
                                        <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-black/20 overflow-hidden shrink-0 flex items-center justify-center relative border border-gray-100 dark:border-white/5">
                                            {(res.item.type === MediaType.IMAGE || res.item.type === MediaType.VIDEO) ? <img src={res.item.content} className="w-full h-full object-cover opacity-90" alt="" loading="lazy"/> : <div className={`${st.t}`}>{getIcon(res.item.type)}</div>}
                                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-bold px-1.5 rounded-bl-lg">{res.score}%</div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${st.b} ${st.t}`}>{res.item.type}</span>
                                                    <span className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar size={10} />{new Date(res.item.createdAt).toLocaleDateString('ar-SA')}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onJumpToMemory(res.item.id); }} 
                                                        className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                                        title="عرض في الجدول الزمني"
                                                    >
                                                        <ArrowUpRight size={16} />
                                                    </button>
                                                    {isExpanded ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                                                </div>
                                            </div>
                                            <p className="text-xs font-bold text-foreground line-clamp-1 mb-0.5">{res.item.summary || "بدون عنوان"}</p>
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1"><ArrowUpRight size={10} className="text-primary" />{res.relevanceReason}</p>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 pb-3 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="h-px bg-gray-100 dark:bg-white/5 w-full mb-3" />
                                            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap border border-gray-100 dark:border-white/5">{res.item.transcription || res.item.content}</div>
                                            <button onClick={(e) => { e.stopPropagation(); onJumpToMemory(res.item.id); }} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"><span>عرض في الجدول الزمني</span><ExternalLink size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 dark:from-dark dark:via-dark/95 to-transparent z-20">
          <form onSubmit={(e) => handleSearch(e)} className="relative max-w-md mx-auto">
            {/* Auto Suggestions Dropdown (Upwards) */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 z-50">
                    {suggestions.map((s, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleSuggestionClick(s.text)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors text-right"
                        >
                            {s.type === 'history' ? <Clock size={14} className="text-gray-400" /> : <Hash size={14} className="text-secondary" />}
                            <span className="flex-1 line-clamp-1">{s.text}</span>
                            <ArrowUpLeft size={14} className="text-gray-300 dark:text-gray-600" />
                        </button>
                    ))}
                </div>
            )}

            <div className="relative shadow-2xl rounded-2xl">
                <button type="button" onClick={handleVoiceSearch} className={`absolute right-2 top-2 bottom-2 p-2 rounded-xl transition-all z-10 ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-foreground'}`}>{isListening ? <MicOff size={20} /> : <Mic size={20} />}</button>
                <input 
                    ref={inputRef}
                    type="text" 
                    value={query} 
                    onChange={handleInputChange} 
                    placeholder={isListening ? "جاري الاستماع..." : "اكتب سؤالك هنا..."} 
                    className={`w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl py-4 px-6 pr-12 pl-14 text-sm text-foreground focus:outline-none focus:border-primary/50 shadow-xl ${isListening ? 'border-red-500/30' : ''}`} 
                    disabled={isSearching} 
                    onFocus={() => { if (query) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                <div className="absolute left-2 top-2 bottom-2 flex items-center gap-1">
                    {query && <button type="button" onClick={() => { setQuery(""); setResponse(""); setResults([]); setShowSuggestions(false); }} className="p-2 text-gray-400 hover:text-foreground"><X size={18} /></button>}
                    <button type="submit" disabled={isSearching || !query.trim()} className="bg-gradient-to-r from-primary to-secondary text-white p-2 rounded-xl w-10 h-10 flex items-center justify-center shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">{isSearching ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="mr-0.5" />}</button>
                </div>
            </div>
          </form>
      </div>
    </div>
  );
};
