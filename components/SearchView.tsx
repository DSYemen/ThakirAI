import React, { useState, useEffect } from 'react';
import { Send, Sparkles, Bot, Search as SearchIcon, Calendar, ArrowUpRight, Play, Video, Image as ImageIcon, FileText, X, ChevronDown, ChevronUp, Clock, Trash2, History } from 'lucide-react';
import { getMemories } from '../services/db';
import { smartSearch } from '../services/geminiService';
import { MediaType, SearchResult, MemoryItem } from '../types';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('thakira_search_history');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = (newQuery: string) => {
    const trimmed = newQuery.trim();
    if (!trimmed) return;
    
    // Remove duplicate if exists, add to top, keep max 10
    const updated = [trimmed, ...searchHistory.filter(h => h !== trimmed)].slice(0, 10);
    setSearchHistory(updated);
    localStorage.setItem('thakira_search_history', JSON.stringify(updated));
  };

  const deleteFromHistory = (e: React.MouseEvent, itemToDelete: string) => {
    e.stopPropagation();
    const updated = searchHistory.filter(item => item !== itemToDelete);
    setSearchHistory(updated);
    localStorage.setItem('thakira_search_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
    if (confirm("هل تريد مسح سجل البحث بالكامل؟")) {
      setSearchHistory([]);
      localStorage.removeItem('thakira_search_history');
    }
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    
    const textToSearch = overrideQuery || query;
    if (!textToSearch.trim()) return;

    if (overrideQuery) setQuery(overrideQuery);

    setIsSearching(true);
    setResponse("");
    setResults([]);
    setExpandedId(null);
    saveToHistory(textToSearch); // Save to history

    try {
      const memories = await getMemories();
      const recentMemories = memories.slice(0, 50); // Search in last 50 memories for performance
      const { answer, results: rawResults } = await smartSearch(textToSearch, recentMemories);
      
      setResponse(answer);
      
      const mappedResults: SearchResult[] = rawResults.map(r => {
          const item = memories.find(m => m.id === r.id);
          if (!item) return null;
          return {
              item,
              score: r.score,
              relevanceReason: r.reason
          };
      }).filter(Boolean) as SearchResult[];

      setResults(mappedResults);

    } catch (err) {
      setResponse("عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي.");
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
      setQuery("");
      setResponse("");
      setResults([]);
  };

  const toggleExpand = (id: string) => {
      setExpandedId(expandedId === id ? null : id);
  };

  const getIcon = (type: MediaType) => {
      switch(type) {
          case MediaType.AUDIO: return <Play size={14} />;
          case MediaType.VIDEO: return <Video size={14} />;
          case MediaType.IMAGE: return <ImageIcon size={14} />;
          default: return <FileText size={14} />;
      }
  };

  const getColor = (type: MediaType) => {
      switch(type) {
          case MediaType.AUDIO: return 'text-blue-400 bg-blue-400/10';
          case MediaType.VIDEO: return 'text-red-400 bg-red-400/10';
          case MediaType.IMAGE: return 'text-purple-400 bg-purple-400/10';
          default: return 'text-green-400 bg-green-400/10';
      }
  };

  return (
    <div className="flex flex-col h-full bg-dark">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col items-center pb-32">
        
        {!response && !isSearching && (
            <div className="mt-8 w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Header (Only show if no results yet) */}
                <div className="text-center space-y-2">
                    <div className="inline-block p-4 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/5 shadow-2xl shadow-purple-500/10">
                        <Sparkles size={32} className="text-purple-300" />
                    </div>
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        المساعد الذكي
                    </h2>
                </div>

                {/* History Section */}
                {searchHistory.length > 0 && (
                    <div className="w-full">
                         <div className="flex items-center justify-between mb-3 px-2">
                            <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                                <History size={14} />
                                سجل البحث
                            </h3>
                            <button onClick={clearHistory} className="text-[10px] text-red-400/70 hover:text-red-400">
                                مسح الكل
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {searchHistory.map((item, i) => (
                                <div 
                                    key={i}
                                    onClick={() => handleSearch(undefined, item)}
                                    className="group flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-3 text-sm text-gray-300">
                                        <Clock size={14} className="text-gray-500" />
                                        <span className="line-clamp-1">{item}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => deleteFromHistory(e, item)}
                                        className="text-gray-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Suggestions Section */}
                <div className="w-full">
                    <h3 className="text-xs font-bold text-gray-500 mb-3 px-2">مقترحات لك</h3>
                    <div className="grid grid-cols-1 gap-2 w-full text-sm">
                        {["لخص لي الأسبوع الماضي", "ماذا قلت في الاجتماع الصوتي؟", "ابحث عن صورة في الحديقة"].map((suggestion, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSearch(undefined, suggestion)}
                                className="bg-card/30 hover:bg-card border border-white/5 p-3 rounded-xl text-gray-400 hover:text-white transition-colors text-right"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Loading State */}
        {isSearching && (
             <div className="flex flex-col items-center gap-4 mt-20">
                 <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                 <p className="text-sm text-gray-400 animate-pulse">جاري البحث والتحليل...</p>
             </div>
        )}

        {/* Results Area */}
        {(response || results.length > 0) && !isSearching && (
            <div className="w-full max-w-md animate-in slide-in-from-bottom-2 space-y-6">
                
                {/* AI Answer Bubble */}
                <div className="flex gap-3 items-start">
                    <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-full mt-1 shrink-0 shadow-lg">
                        <Bot size={20} className="text-white" />
                    </div>
                    <div className="flex-1 bg-card border border-white/10 p-5 rounded-2xl rounded-tr-none text-gray-200 leading-relaxed shadow-lg text-sm relative">
                        {response}
                        <div className="absolute -bottom-2 -left-2 bg-dark rounded-full p-1 border border-white/5">
                            <Sparkles size={12} className="text-secondary" />
                        </div>
                    </div>
                </div>

                {/* Matching Results List */}
                {results.length > 0 && (
                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between px-2">
                             <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                                <SearchIcon size={14} />
                                نتائج البحث ({results.length})
                            </h3>
                        </div>
                       
                        
                        {results.map((res, idx) => {
                            const isExpanded = expandedId === res.item.id;
                            return (
                                <div 
                                    key={res.item.id} 
                                    onClick={() => toggleExpand(res.item.id)}
                                    className={`bg-card/40 border border-white/5 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:bg-card/60 ${isExpanded ? 'bg-card/80 border-primary/30 ring-1 ring-primary/20' : ''}`}
                                >
                                    <div className="p-3 flex gap-3">
                                        {/* Thumbnail / Icon */}
                                        <div className="w-16 h-16 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center relative self-start">
                                            {(res.item.type === MediaType.IMAGE || res.item.type === MediaType.VIDEO) ? (
                                                <img src={res.item.content} className="w-full h-full object-cover opacity-80" alt="thumbnail" loading="lazy"/>
                                            ) : (
                                                <div className={`p-2 rounded-full ${getColor(res.item.type)}`}>
                                                    {getIcon(res.item.type)}
                                                </div>
                                            )}
                                            {/* Score Badge */}
                                            <div className="absolute top-0 right-0 bg-green-500 text-dark text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg shadow-sm">
                                                {res.score}%
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${getColor(res.item.type)}`}>
                                                        {res.item.type === MediaType.AUDIO ? 'صوت' : res.item.type === MediaType.VIDEO ? 'فيديو' : res.item.type === MediaType.IMAGE ? 'صورة' : 'نص'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        <Calendar size={10} />
                                                        {new Date(res.item.createdAt).toLocaleDateString('ar-SA')}
                                                    </span>
                                                </div>
                                                {isExpanded ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
                                            </div>
                                            
                                            <p className="text-xs text-white/90 font-medium line-clamp-1 mb-0.5">
                                                {res.item.summary || "بدون عنوان"}
                                            </p>
                                            
                                            {/* Relevance Reason */}
                                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <ArrowUpRight size={10} className="text-primary" />
                                                {res.relevanceReason}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="h-px bg-white/5 w-full mb-3" />
                                            <div className="bg-black/20 rounded-lg p-3 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                                                {res.item.transcription || res.item.content}
                                            </div>
                                            {res.item.tags.length > 0 && (
                                                <div className="flex gap-2 mt-3 flex-wrap">
                                                    {res.item.tags.map(t => (
                                                        <span key={t} className="text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded">#{t}</span>
                                                    ))}
                                                </div>
                                            )}
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

      {/* Input Area */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-dark via-dark/95 to-transparent z-20">
          <form onSubmit={(e) => handleSearch(e)} className="relative max-w-md mx-auto shadow-2xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              className="w-full bg-card border border-white/10 rounded-2xl py-4 px-6 pl-20 text-right text-white focus:outline-none focus:bg-card/80 focus:border-primary/50 transition-all shadow-black/50 shadow-xl"
              disabled={isSearching}
            />
            
            <div className="absolute left-2 top-2 bottom-2 flex items-center gap-1">
                {query && (
                    <button
                        type="button"
                        onClick={clearSearch}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
                <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="bg-gradient-to-r from-primary to-secondary text-white p-2 rounded-xl w-10 h-10 flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all"
                >
                {isSearching ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Send size={18} className="mr-0.5" />}
                </button>
            </div>
          </form>
      </div>
    </div>
  );
};