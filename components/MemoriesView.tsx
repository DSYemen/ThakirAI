
import React, { useEffect, useState, useRef } from 'react';
import { getPagedMemories, deleteMemory, saveMemory, FilterOptions, getMemories, getMemoryById } from '../services/db';
import { MemoryItem, MediaType, Reminder, ReminderFrequency } from '../types';
import { generateGoogleCalendarLink } from '../services/calendarService';
import { analyzeMedia } from '../services/geminiService';
import { getSettings } from '../services/settingsService';
import { Play, FileText, Image, Trash2, Video, Pause, Search, Filter, MoreVertical, FileJson, FileSpreadsheet, X, Clock, ChevronLeft, Star, Bell, Calendar, ChevronDown, ChevronUp, ArrowUpDown, Loader2, CalendarDays, Pin, PinOff, FileDown, Sparkles, Check, CheckSquare, Square } from 'lucide-react';

interface DisplayMemory extends MemoryItem {
    matchScore?: number;
}

interface MemoryCardProps {
    id?: string;
    memory: DisplayMemory;
    isPlaying: boolean;
    onTogglePlay: (id: string) => void;
    onToggleFavorite: (e: React.MouseEvent, id: string) => void;
    onTogglePin: (e: React.MouseEvent, id: string) => void;
    onDelete: (id: string) => void;
    onSetReminder: (e: React.MouseEvent, memory: MemoryItem) => void;
    onExportPDF: (e: React.MouseEvent, memory: MemoryItem) => void;
    onReAnalyze: (e: React.MouseEvent, memory: MemoryItem) => void;
    isHighlighted?: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    language: string;
}

const formatRelativeTime = (timestamp: number, language: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffMs = startOfToday - startOfDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Simple localization for basic relative terms
    const isArabic = language.startsWith('ar');

    if (diffDays === 0) return isArabic ? 'اليوم' : 'Today';
    if (diffDays === 1) return isArabic ? 'أمس' : 'Yesterday';
    if (diffDays === 2) return isArabic ? 'قبل يومين' : '2 days ago';
    if (diffDays > 2 && diffDays <= 7) return isArabic ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
    return date.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'short' });
};

const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MemoryCard: React.FC<MemoryCardProps> = ({ 
    id, memory, isPlaying, onTogglePlay, onToggleFavorite, onTogglePin, onDelete, onSetReminder, onExportPDF, onReAnalyze, isHighlighted,
    isSelectionMode, isSelected, onSelect, language
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => { if (isHighlighted) setIsExpanded(true); }, [isHighlighted]);
    useEffect(() => {
        if (memory.type !== MediaType.AUDIO || !audioRef.current) return;
        if (isPlaying) audioRef.current.play().catch(e => console.error(e));
        else audioRef.current.pause();
    }, [isPlaying, memory.type]);

    const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
    const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) { audioRef.current.currentTime = time; setCurrentTime(time); }
    };

    const getIcon = () => {
        switch(memory.type) {
            case MediaType.AUDIO: return <Play size={16} />;
            case MediaType.VIDEO: return <Video size={16} />;
            case MediaType.IMAGE: return <Image size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const getTypeStyles = () => {
         switch(memory.type) {
            case MediaType.AUDIO: return { text: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20' };
            case MediaType.VIDEO: return { text: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-100 dark:border-red-500/20' };
            case MediaType.IMAGE: return { text: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-100 dark:border-purple-500/20' };
            default: return { text: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-100 dark:border-green-500/20' };
        }
    };
    const styles = getTypeStyles();
    const isPending = memory.analysisStatus === 'PENDING';

    let containerClasses = "group backdrop-blur-sm rounded-2xl overflow-hidden transition-all duration-300 relative border ";
    if (isSelectionMode) {
        if (isSelected) containerClasses += "border-primary bg-primary/5 ring-2 ring-primary/50 shadow-md transform scale-[1.02] z-10 ";
        else containerClasses += "border-gray-200 dark:border-white/5 bg-white/80 dark:bg-card opacity-80 hover:opacity-100 ";
    } else {
        if (isHighlighted) containerClasses += "border-primary ring-2 ring-primary/50 bg-white dark:bg-slate-800 z-10 shadow-lg ";
        else if (memory.isPinned) containerClasses += "border-cyan-200 dark:border-cyan-500/50 bg-white dark:bg-slate-800/90 shadow-md ring-1 ring-cyan-500/10 ";
        else containerClasses += "bg-white dark:bg-card border-gray-200 dark:border-white/5 hover:shadow-md ";
    }

    const handleClick = (e: React.MouseEvent) => {
        if (isSelectionMode) {
            e.stopPropagation();
            onSelect(memory.id);
        } else if (!isPending) {
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div id={id} onClick={handleClick} className={`${containerClasses} ${isPending ? 'opacity-80' : ''} ${isSelectionMode ? 'cursor-pointer' : ''}`}>
            
             {/* Selection Checkbox Overlay */}
             {isSelectionMode && (
                <div className={`absolute top-4 left-4 z-50 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-primary border-primary scale-110' : 'bg-gray-100 dark:bg-white/10 border-gray-300 dark:border-white/20'}`}>
                    {isSelected && <Check size={14} className="text-white" />}
                </div>
            )}

             {memory.reminder && !isHighlighted && !memory.isPinned && !isSelectionMode && (
                <div className="absolute inset-0 rounded-2xl border border-secondary/40 animate-[pulse_3s_infinite] pointer-events-none" />
            )}
            {memory.isPinned && !isSelectionMode && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"></div>}

            <div className="p-4 pb-2 flex justify-between items-start relative z-10">
                 <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl border ${styles.border} ${styles.bg} ${styles.text} flex items-center justify-center shrink-0`}>
                         {getIcon()}
                     </div>
                     <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">
                                {memory.type === MediaType.AUDIO ? (language.startsWith('ar') ? 'تسجيل صوتي' : 'Audio') : 
                                 memory.type === MediaType.VIDEO ? (language.startsWith('ar') ? 'فيديو' : 'Video') : 
                                 memory.type === MediaType.IMAGE ? (language.startsWith('ar') ? 'صورة' : 'Image') : 
                                 (language.startsWith('ar') ? 'نص' : 'Text')}
                            </span>
                             {memory.reminder && (
                                <div className="flex items-center gap-1.5 bg-secondary/10 text-secondary border border-secondary/20 text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                                    <Bell size={10} fill="currentColor" />
                                    <span className="font-bold font-mono tracking-tight">{new Date(memory.reminder.timestamp).toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            )}
                         </div>
                         <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {formatRelativeTime(memory.createdAt, language)}
                         </span>
                     </div>
                 </div>

                 {!isSelectionMode && (
                    <div className="flex items-center gap-2">
                        {isPending && (
                            <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full border border-yellow-500/20">
                                <Loader2 size={10} className="animate-spin" />
                                <span className="text-[10px]">{language.startsWith('ar') ? 'جاري التحليل' : 'Analyzing'}</span>
                            </div>
                        )}
                        {memory.matchScore !== undefined && (
                            <div className="bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                {memory.matchScore}%
                            </div>
                        )}
                        {memory.isPinned && !memory.matchScore && (
                            <div className="text-cyan-500 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-400/10 p-1.5 rounded-full">
                                <Pin size={12} fill="currentColor" />
                            </div>
                        )}
                    </div>
                 )}
            </div>

            <div className={`px-4 py-1 relative z-10 ${isSelectionMode ? 'pl-12' : ''}`}>
                <h3 className={`font-bold text-foreground leading-relaxed transition-all duration-300 ${isExpanded ? 'text-lg mb-2' : 'text-sm line-clamp-1'} ${isPending ? 'animate-pulse text-gray-400' : ''}`}>
                    {memory.summary || (isPending ? (language.startsWith('ar') ? "جاري استخراج العنوان..." : "Processing...") : (language.startsWith('ar') ? "بدون عنوان" : "No Title"))}
                </h3>
                {!isExpanded && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {isPending ? (language.startsWith('ar') ? "يتم الآن معالجة المحتوى بواسطة الذكاء الاصطناعي..." : "AI is analyzing content...") : (memory.transcription || memory.content)}
                    </p>
                )}
            </div>

            {isExpanded && !isPending && !isSelectionMode && (
                <div className="px-4 py-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative z-10">
                    <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5">
                        {memory.type === MediaType.IMAGE && <img src={memory.content} alt="Memory" className="w-full h-auto max-h-[400px] object-contain" />}
                        {memory.type === MediaType.VIDEO && <video src={memory.content} controls className="w-full max-h-[400px]" />}
                        {memory.type === MediaType.AUDIO && (
                            <div className="p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-4">
                                    <button onClick={(e) => { e.stopPropagation(); onTogglePlay(memory.id); }} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform">
                                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                                    </button>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek} onClick={(e) => e.stopPropagation()} className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg accent-primary" />
                                        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                                            <span>{formatDuration(currentTime)}</span><span>{formatDuration(duration)}</span>
                                        </div>
                                    </div>
                                </div>
                                <audio ref={audioRef} src={memory.content} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={() => onTogglePlay(memory.id)} className="hidden" />
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                            <FileText size={12} /><span>{language.startsWith('ar') ? 'التفاصيل الكاملة' : 'Full Details'}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-loose whitespace-pre-wrap">{memory.transcription || memory.content}</p>
                    </div>

                    {memory.reminder && (
                         <button onClick={(e) => { e.stopPropagation(); generateGoogleCalendarLink(memory); }} className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 py-3 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                             <CalendarDays size={14} className="text-blue-500" /> {language.startsWith('ar') ? 'إضافة لتقويم جوجل' : 'Add to Google Calendar'}
                         </button>
                    )}
                </div>
            )}

            {!isSelectionMode && (
                <div className="px-4 py-3 mt-2 border-t border-gray-100 dark:border-white/5 flex flex-col gap-3 relative z-10">
                    {memory.tags && memory.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {memory.tags.map((tag, idx) => (
                                <span key={idx} className="text-[10px] text-secondary bg-secondary/10 border border-secondary/20 px-2 py-1 rounded-md">#{tag.replace(/\s+/g, '_')}</span>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-1">
                        <div className="flex items-center gap-1">
                            <button onClick={(e) => onSetReminder(e, memory)} className={`p-2 rounded-full transition-all ${memory.reminder ? 'text-secondary bg-secondary/10' : 'text-gray-400 hover:text-secondary'}`}><Bell size={18} fill={memory.reminder ? "currentColor" : "none"} /></button>
                            <button onClick={(e) => onReAnalyze(e, memory)} disabled={isPending} className={`p-2 rounded-full transition-all ${isPending ? 'text-yellow-500/50' : 'text-gray-400 hover:text-yellow-500'}`}><Sparkles size={18} className={isPending ? 'animate-pulse' : ''} /></button>
                            <button onClick={(e) => onExportPDF(e, memory)} disabled={isPending} className="p-2 rounded-full text-gray-400 hover:text-blue-500"><FileDown size={18} /></button>
                            <button onClick={(e) => onToggleFavorite(e, memory.id)} className={`p-2 rounded-full transition-all ${memory.isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-400 hover:text-yellow-400'}`}><Star size={18} fill={memory.isFavorite ? "currentColor" : "none"} /></button>
                            <button onClick={(e) => onTogglePin(e, memory.id)} className={`p-2 rounded-full transition-all ${memory.isPinned ? 'text-cyan-500 bg-cyan-100 dark:bg-cyan-500/10' : 'text-gray-400 hover:text-cyan-500'}`}>{memory.isPinned ? <PinOff size={18} /> : <Pin size={18} />}</button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(memory.id); }} className="p-2 rounded-full text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                        {!isPending && <button className="flex items-center gap-1.5 text-xs text-primary font-medium">{isExpanded ? <><span className="text-[10px]">{language.startsWith('ar') ? 'إغلاق' : 'Close'}</span><ChevronUp size={14} /></> : <><span className="text-[10px]">{language.startsWith('ar') ? 'المزيد' : 'More'}</span><ChevronDown size={14} /></>}</button>}
                    </div>
                </div>
            )}
            {memory.type === MediaType.AUDIO && <audio id={`audio-${memory.id}`} src={memory.content} className="hidden" />}
        </div>
    );
};

export const MemoriesView: React.FC<{ highlightedMemoryId?: string | null }> = ({ highlightedMemoryId }) => {
  const [memories, setMemories] = useState<DisplayMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<{ value: any; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [language, setLanguage] = useState('ar-SA');

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<MediaType | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'DATE' | 'FAVORITES' | 'PINNED'>('DATE');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showMenu, setShowMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderFreq, setReminderFreq] = useState<ReminderFrequency>('ONCE');
  const [reminderInterval, setReminderInterval] = useState<number>(1);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [printableMemories, setPrintableMemories] = useState<MemoryItem[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const observerTarget = useRef(null);

  useEffect(() => { 
      const settings = getSettings();
      setLanguage(settings.language || 'ar-SA');
  }, []);

  useEffect(() => { if (highlightedMemoryId) handleHighlight(highlightedMemoryId); }, [highlightedMemoryId]);

  const handleHighlight = async (id: string) => {
    const exists = memories.find(m => m.id === id);
    if (!exists) {
        try {
            const memory = await getMemoryById(id);
            if (memory) setMemories(prev => [memory as DisplayMemory, ...prev]);
        } catch (e) { console.error(e); }
    }
    setTimeout(() => { document.getElementById(`memory-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
  };

  useEffect(() => { setMemories([]); setCursor(null); setHasMore(true); loadMemories(true); }, [filterType, timeFilter, showFavoritesOnly, showPinnedOnly, sortBy, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) loadMemories(false); }, { threshold: 1.0 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [hasMore, loading, loadingMore, cursor]);

  useEffect(() => {
    if (printableMemories && printableMemories.length > 0) {
        setIsExporting(true); setExportProgress(0);
        let currentStep = 0; const totalSteps = 20;
        const interval = setInterval(() => {
            currentStep++; setExportProgress(Math.min(Math.round((currentStep / totalSteps) * 100), 100));
            if (currentStep >= totalSteps) { clearInterval(interval); setTimeout(() => window.print(), 200); }
        }, 50);
        return () => clearInterval(interval);
    }
  }, [printableMemories]);

  useEffect(() => {
      const handleAfterPrint = () => { setPrintableMemories(null); setIsExporting(false); setExportProgress(0); };
      window.addEventListener("afterprint", handleAfterPrint);
      return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const loadMemories = async (reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
        const filters: FilterOptions = { type: filterType, timeFilter, showFavoritesOnly, showPinnedOnly, searchQuery, sortBy };
        const result = await getPagedMemories(15, reset ? null : cursor, filters);
        const newItems: DisplayMemory[] = result.items.map(item => {
            if (!searchQuery) return item;
            let score = 0; const q = searchQuery.toLowerCase();
            if (item.summary?.toLowerCase().includes(q)) score += 50;
            if (item.transcription?.toLowerCase().includes(q)) score += 30;
            if (item.tags?.some(t => t.toLowerCase().includes(q))) score += 40;
            return { ...item, matchScore: Math.min(score, 100) };
        });
        if (reset) setMemories(newItems);
        else setMemories(prev => {
                const combined = [...prev, ...newItems];
                return Array.from(new Map(combined.map(item => [item.id, item])).values());
            });
        setCursor(result.nextCursor); setHasMore(!!result.nextCursor);
    } catch (error) { console.error(error); } finally { if (reset) setLoading(false); else setLoadingMore(false); }
  };

  const handleDelete = async (id: string) => { if (confirm("هل أنت متأكد من حذف هذه الذكرى؟")) { await deleteMemory(id); setMemories(prev => prev.filter(m => m.id !== id)); } };
  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); const memory = memories.find(m => m.id === id); if (!memory) return; const updated = { ...memory, isFavorite: !memory.isFavorite }; setMemories(prev => prev.map(m => m.id === id ? updated : m)); await saveMemory(updated); };
  const handleTogglePin = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); const memory = memories.find(m => m.id === id); if (!memory) return; const updated = { ...memory, isPinned: !memory.isPinned }; setMemories(prev => prev.map(m => m.id === id ? updated : m)); await saveMemory(updated); };
  const handleReAnalyze = async (e: React.MouseEvent, memory: MemoryItem) => {
      e.stopPropagation(); if (!memory) return;
      const pending: DisplayMemory = { ...memory, analysisStatus: 'PENDING', summary: "جاري إعادة التحليل..." };
      setMemories(prev => prev.map(m => m.id === memory.id ? pending : m)); await saveMemory(pending);
      try {
          const analysis = await analyzeMedia(memory.type, memory.content);
          let finalReminder = memory.reminder;
          if (!finalReminder && analysis.detectedReminder) finalReminder = { timestamp: new Date(analysis.detectedReminder.isoTimestamp).getTime(), frequency: analysis.detectedReminder.frequency, interval: analysis.detectedReminder.interval || 1 };
          const updated: MemoryItem = { ...memory, transcription: analysis.transcription, summary: analysis.summary, tags: analysis.tags, reminder: finalReminder, analysisStatus: 'COMPLETED' };
          await saveMemory(updated); setMemories(prev => prev.map(m => m.id === memory.id ? updated : m));
      } catch (err) { const failed: MemoryItem = { ...memory, analysisStatus: 'FAILED', summary: "فشل التحليل" }; await saveMemory(failed); setMemories(prev => prev.map(m => m.id === memory.id ? failed : m)); }
  };

  const handleExportPDF = (e: React.MouseEvent, memory?: MemoryItem) => { e.stopPropagation(); setShowMenu(false); if (memory) setPrintableMemories([memory]); else { setLoading(true); setPrintableMemories(memories); setLoading(false); } };
  const openReminderModal = (e: React.MouseEvent, memory: MemoryItem) => {
      e.stopPropagation(); setSelectedMemoryId(memory.id);
      if (memory.reminder) { 
          const date = new Date(memory.reminder.timestamp); 
          setReminderDate(new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)); 
          setReminderFreq(memory.reminder.frequency); 
          setReminderInterval(memory.reminder.interval || 1);
      }
      else { setReminderDate(""); setReminderFreq('ONCE'); setReminderInterval(1); }
      setReminderModalOpen(true);
  };
  const saveReminder = async () => {
      if (!selectedMemoryId) return; const memory = memories.find(m => m.id === selectedMemoryId); if (!memory) return;
      const updated = { ...memory, reminder: reminderDate ? { timestamp: new Date(reminderDate).getTime(), frequency: reminderFreq, interval: reminderInterval } : undefined };
      setMemories(prev => prev.map(m => m.id === selectedMemoryId ? updated : m)); await saveMemory(updated); setReminderModalOpen(false);
  };
  const togglePlay = (id: string) => {
      if (playingId === id) { setPlayingId(null); (document.getElementById(`audio-${id}`) as HTMLAudioElement)?.pause(); }
      else { if (playingId) (document.getElementById(`audio-${playingId}`) as HTMLAudioElement)?.pause(); setPlayingId(id); const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement; if (audio) { audio.currentTime = 0; audio.play(); } }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
    setShowMenu(false);
  };

  const handleSelectMemory = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    const selected = memories.filter(m => selectedIds.has(m.id));
    setPrintableMemories(selected);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} عنصر؟`)) return;
      
      for (const id of selectedIds) {
          await deleteMemory(id);
      }
      setMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
      setIsSelectionMode(false);
      setSelectedIds(new Set());
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: MediaType | 'ALL', label: string, icon: any }) => (
      <button onClick={() => setFilterType(type)} title={label} className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${filterType === type ? 'bg-primary text-white shadow-md scale-110 z-10' : 'bg-white/50 dark:bg-white/5 text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-white/10'}`}><Icon size={16} /></button>
  );

  const freqOptions: {val: ReminderFrequency, label: string}[] = [
    { val: 'ONCE', label: 'مرة واحدة' },
    { val: 'HOURLY', label: 'ساعات' },
    { val: 'DAILY', label: 'أيام' },
    { val: 'WEEKLY', label: 'أسابيع' },
    { val: 'MONTHLY', label: 'أشهر' },
    { val: 'YEARLY', label: 'سنوات' },
  ];

  return (
    <div className="flex flex-col h-full bg-dark relative">
      <div className="flex flex-col h-full print:hidden">
        {/* Unified Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between h-10">
                {isSearchOpen ? (
                    <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-2 fade-in duration-200">
                        <div className="relative flex-1">
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث..." autoFocus className="w-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl py-2 px-3 pl-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute left-2 top-2 text-gray-400"><X size={14} /></button>}
                        </div>
                        <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-gray-400 p-1"><ChevronLeft size={20} className="rtl:rotate-180" /></button>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold text-foreground">شريط الذكريات</h2>
                        <div className="flex items-center gap-2">
                            {isSelectionMode ? (
                                <button onClick={() => setIsSelectionMode(false)} className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-lg text-sm font-bold text-gray-500">إلغاء</button>
                            ) : (
                                <>
                                    <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300"><Search size={20} /></button>
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-md font-mono">{memories.length}</span>
                                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300"><MoreVertical size={20} /></button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
            {/* Filter Bar */}
            <div className={`transition-all duration-300 overflow-hidden ${isSearchOpen ? 'h-0 opacity-0' : 'h-auto opacity-100'}`}>
                <div className="w-full overflow-x-auto pb-2 pt-1 px-1 no-scrollbar">
                    <div className="flex items-center gap-2 min-w-max">
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setShowPinnedOnly(!showPinnedOnly)} className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${showPinnedOnly ? 'bg-cyan-100 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30 text-cyan-500' : 'bg-white/50 dark:bg-white/5 border-transparent text-gray-400'}`}><Pin size={16} fill={showPinnedOnly ? "currentColor" : "none"}/></button>
                            <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${showFavoritesOnly ? 'bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-500' : 'bg-white/50 dark:bg-white/5 border-transparent text-gray-400'}`}><Star size={16} fill={showFavoritesOnly ? "currentColor" : "none"}/></button>
                        </div>
                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1 shrink-0" />
                        <div className="flex items-center gap-2 shrink-0">
                            <FilterButton type="ALL" label="الكل" icon={Filter} />
                            <FilterButton type={MediaType.AUDIO} label="صوت" icon={Play} />
                            <FilterButton type={MediaType.VIDEO} label="فيديو" icon={Video} />
                            <FilterButton type={MediaType.IMAGE} label="صور" icon={Image} />
                            <FilterButton type={MediaType.TEXT} label="نص" icon={FileText} />
                        </div>
                        <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1 shrink-0" />
                        <div className="relative flex items-center shrink-0" onMouseEnter={() => setShowTimeMenu(true)} onMouseLeave={() => setShowTimeMenu(false)}>
                            <button onClick={(e) => { e.stopPropagation(); setShowTimeMenu(!showTimeMenu); }} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${timeFilter !== 'ALL' ? 'bg-secondary text-white' : 'bg-white/50 dark:bg-white/5 text-gray-400'}`}><Clock size={16} /></button>
                            <div className={`absolute top-full left-0 mt-2 w-32 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden transition-all duration-200 z-50 ${showTimeMenu ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible'}`}>
                                <div className="flex flex-col p-1">
                                    {[{ type: 'ALL', label: 'الكل' }, { type: 'TODAY', label: 'اليوم' }, { type: 'WEEK', label: 'أسبوع' }, { type: 'MONTH', label: 'شهر' }].map((opt) => (
                                        <button key={opt.type} onClick={(e) => { e.stopPropagation(); setTimeFilter(opt.type as any); setShowTimeMenu(false); }} className={`text-right px-3 py-2 text-xs rounded-lg ${timeFilter === opt.type ? 'bg-secondary/10 text-secondary' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showMenu && (
                <div className="absolute top-16 left-4 z-50 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-2 w-48 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => setSortBy('DATE')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><Clock size={16} /> الأحدث</button>
                    <button onClick={() => setSortBy('FAVORITES')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><Star size={16} /> المفضلة</button>
                    <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                    <button onClick={toggleSelectionMode} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><CheckSquare size={16} /> تحديد عناصر</button>
                    <button onClick={(e) => handleExportPDF(e)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><FileDown size={16} /> تصدير الكل PDF</button>
                </div>
            )}
        </div>
        
        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
            {loading && memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="animate-spin text-primary" size={32} /><p className="text-gray-500 text-sm">جاري التحميل...</p></div>
            ) : memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Search size={48} className="mb-4 stroke-1" /><p>لا توجد ذكريات.</p></div>
            ) : (
                <>
                    {memories.map((mem) => (
                        <MemoryCard 
                            key={mem.id} 
                            id={`memory-card-${mem.id}`} 
                            memory={mem} 
                            isPlaying={playingId === mem.id} 
                            onTogglePlay={togglePlay} 
                            onToggleFavorite={handleToggleFavorite} 
                            onTogglePin={handleTogglePin} 
                            onDelete={handleDelete} 
                            onSetReminder={openReminderModal} 
                            onExportPDF={handleExportPDF} 
                            onReAnalyze={handleReAnalyze} 
                            isHighlighted={highlightedMemoryId === mem.id}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(mem.id)}
                            onSelect={handleSelectMemory}
                            language={language}
                        />
                    ))}
                    <div ref={observerTarget} className="h-20 flex items-center justify-center">{loadingMore && <Loader2 className="animate-spin text-gray-500" size={24} />}</div>
                </>
            )}
        </div>

        {/* Selection Action Bar */}
        {isSelectionMode && (
            <div className="fixed bottom-24 left-4 right-4 z-40 animate-in slide-in-from-bottom-10 duration-300">
                <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm">{selectedIds.size}</span>
                        <span className="text-sm font-bold text-gray-500">عنصر محدد</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={handleBulkDelete}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs disabled:opacity-50"
                         >
                             <Trash2 size={16} />
                             حذف
                         </button>
                         <button 
                            onClick={handleBulkExport}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-lg shadow-primary/20 disabled:opacity-50"
                         >
                             <FileDown size={16} />
                             تصدير PDF
                         </button>
                    </div>
                </div>
            </div>
        )}
      </div>

       {/* Reminder Modal */}
       {reminderModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden" onClick={() => setReminderModalOpen(false)}>
                <div className="bg-white dark:bg-card w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                        <h3 className="font-bold text-foreground flex items-center gap-2"><Calendar size={18} className="text-secondary" />تذكير</h3>
                        <button onClick={() => setReminderModalOpen(false)} className="text-gray-400 hover:text-foreground"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">التاريخ والوقت</label>
                            <input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-foreground focus:border-primary focus:outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">نمط التكرار</label>
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-3 gap-2">
                                    {freqOptions.map((opt) => (
                                        <button key={opt.val} onClick={() => setReminderFreq(opt.val)} className={`text-xs py-2 rounded-lg border transition-all ${reminderFreq === opt.val ? 'bg-secondary/10 border-secondary text-secondary font-bold' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {reminderFreq !== 'ONCE' && (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/10">
                                        <label className="text-xs font-bold text-gray-500 whitespace-nowrap">كل</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="100" 
                                            value={reminderInterval} 
                                            onChange={(e) => setReminderInterval(parseInt(e.target.value) || 1)} 
                                            className="w-16 text-center bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-1 text-sm font-bold"
                                        />
                                        <span className="text-xs font-bold text-gray-500">
                                            {reminderFreq === 'HOURLY' ? (reminderInterval > 1 ? 'ساعات' : 'ساعة') :
                                             reminderFreq === 'DAILY' ? (reminderInterval > 1 ? 'أيام' : 'يوم') :
                                             reminderFreq === 'WEEKLY' ? (reminderInterval > 1 ? 'أسابيع' : 'أسبوع') :
                                             reminderFreq === 'MONTHLY' ? (reminderInterval > 1 ? 'أشهر' : 'شهر') :
                                             (reminderInterval > 1 ? 'سنوات' : 'سنة')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={saveReminder} className="w-full bg-primary text-white font-bold py-3 rounded-xl">حفظ</button>
                    </div>
                </div>
            </div>
        )}

        {/* Print Template & Export Progress */}
        {isExporting && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
                 <div className="bg-white dark:bg-card w-full max-w-xs p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl text-center space-y-5">
                     <FileDown size={32} className="mx-auto text-primary animate-bounce" />
                     <div>
                        <h3 className="text-lg font-bold text-foreground">جاري تحضير الملف...</h3>
                        <p className="text-sm text-gray-500 mt-1">يرجى الانتظار بينما نقوم بمعالجة الصور والنصوص</p>
                     </div>
                     <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                            <span className="text-xs font-semibold inline-block text-primary">المعالجة</span>
                            <span className="text-xs font-semibold inline-block text-primary">{exportProgress}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${exportProgress}%` }} />
                        </div>
                     </div>
                 </div>
             </div>
        )}
        {printableMemories && (
            <div id="print-container" className="hidden print:block fixed inset-0 bg-white z-[9999] overflow-visible text-black p-8">
                <div className="text-center border-b-2 border-gray-300 pb-6 mb-8">
                    <h1 className="text-4xl font-bold mb-2">تقرير الذكريات</h1>
                    <p className="text-gray-500">تم الاستخراج بتاريخ {new Date().toLocaleDateString(language)}</p>
                </div>
                <div className="space-y-8">
                    {printableMemories.map((item) => (
                        <div key={item.id} className="page-break border border-gray-200 rounded-xl p-6 bg-gray-50">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold mb-1">{item.summary || "بدون عنوان"}</h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                        <span>{new Date(item.createdAt).toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        <span>•</span>
                                        <span className="font-bold">{item.type}</span>
                                    </div>
                                </div>
                                {item.isFavorite && <span className="text-yellow-500 text-2xl">★</span>}
                            </div>
                            
                            {/* Content */}
                            <div className="mb-4 text-gray-800 leading-relaxed text-justify whitespace-pre-wrap">
                                {item.transcription || item.content}
                            </div>

                            {/* Media Thumbnail for Image */}
                            {item.type === MediaType.IMAGE && (
                                <div className="mb-4 w-full max-h-64 overflow-hidden rounded-lg border border-gray-300">
                                    <img src={item.content} className="w-full h-full object-cover" alt="Memory" />
                                </div>
                            )}

                            {/* Tags */}
                            {item.tags && item.tags.length > 0 && (
                                <div className="flex gap-2 mt-4">
                                    {item.tags.map((tag, i) => (
                                        <span key={i} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
                    تم الإنشاء بواسطة تطبيق الذاكرة الذكية
                </div>
            </div>
        )}
    </div>
  );
};