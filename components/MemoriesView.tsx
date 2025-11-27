import React, { useEffect, useState, useRef } from 'react';
import { getPagedMemories, deleteMemory, saveMemory, FilterOptions, getMemories, getMemoryById } from '../services/db';
import { MemoryItem, MediaType, Reminder, ReminderFrequency } from '../types';
import { generateGoogleCalendarLink } from '../services/calendarService';
import { analyzeMedia } from '../services/geminiService';
import { getSettings } from '../services/settingsService';
import { reminderService } from '../services/reminderService';
import { offlineService } from '../services/offlineService';
import { Play, FileText, Image, Trash2, Video, Pause, Search, Filter, MoreVertical, FileJson, FileSpreadsheet, X, Clock, ChevronLeft, Star, Bell, Calendar, ChevronDown, ChevronUp, ArrowUpDown, Loader2, CalendarDays, Pin, PinOff, FileDown, Sparkles, Check, CheckSquare, Square, CloudOff, Printer, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

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
    onViewMedia: (memory: MemoryItem) => void;
    isHighlighted?: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    language: string;
    isOnline?: boolean;
}

const formatRelativeTime = (timestamp: number, language: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffMs = startOfToday - startOfDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
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

// --- New Media Viewer Component ---
const MediaViewer: React.FC<{ memory: MemoryItem; onClose: () => void }> = ({ memory, onClose }) => {
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 1));
    
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="flex justify-between items-center p-4 z-50 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 backdrop-blur-md">
                    <X size={24} />
                </button>
                
                {memory.type === MediaType.IMAGE && (
                    <div className="flex gap-4">
                        <button onClick={handleZoomOut} disabled={scale <= 1} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 disabled:opacity-30 backdrop-blur-md">
                            <ZoomOut size={24} />
                        </button>
                        <span className="text-white font-mono flex items-center">{Math.round(scale * 100)}%</span>
                        <button onClick={handleZoomIn} disabled={scale >= 4} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 disabled:opacity-30 backdrop-blur-md">
                            <ZoomIn size={24} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content Container */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-auto flex items-center justify-center p-4 touch-none"
            >
                {memory.type === MediaType.IMAGE ? (
                    <div 
                        className="transition-transform duration-200 ease-out origin-center"
                        style={{ transform: `scale(${scale})` }}
                    >
                        <img 
                            src={memory.content} 
                            alt="Full View" 
                            className="max-w-full max-h-[85vh] object-contain shadow-2xl"
                        />
                    </div>
                ) : (
                    <video 
                        src={memory.content} 
                        controls 
                        autoPlay 
                        className="max-w-full max-h-[80vh] w-full object-contain shadow-2xl rounded-lg"
                    />
                )}
            </div>

            {/* Footer Caption */}
            <div className="p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white z-50">
                <h3 className="text-lg font-bold mb-1">{memory.summary || "Media View"}</h3>
                <p className="text-sm text-gray-300 line-clamp-2">{memory.transcription}</p>
            </div>
        </div>
    );
};

const MemoryCard: React.FC<MemoryCardProps> = ({ 
    id, memory, isPlaying, onTogglePlay, onToggleFavorite, onTogglePin, onDelete, onSetReminder, onExportPDF, onReAnalyze, onViewMedia, isHighlighted,
    isSelectionMode, isSelected, onSelect, language, isOnline = true
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
    const isOfflinePending = isPending && !isOnline;

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
        <div id={`memory-card-${memory.id}`} onClick={handleClick} className={`${containerClasses} ${isPending ? 'opacity-80' : ''} ${isSelectionMode ? 'cursor-pointer' : ''}`}>
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
                            isOfflinePending ? (
                                <div className="flex items-center gap-1.5 bg-gray-500/10 text-gray-500 px-2 py-1 rounded-full border border-gray-500/20">
                                    <CloudOff size={10} />
                                    <span className="text-[10px]">{language.startsWith('ar') ? 'بانتظار الاتصال' : 'Waiting for connection'}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full border border-yellow-500/20">
                                    <Loader2 size={10} className="animate-spin" />
                                    <span className="text-[10px]">{language.startsWith('ar') ? 'جاري التحليل' : 'Analyzing'}</span>
                                </div>
                            )
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
                        {isPending ? (language.startsWith('ar') ? (isOfflinePending ? "سيتم التحليل عند توفر الإنترنت" : "يتم الآن معالجة المحتوى بواسطة الذكاء الاصطناعي...") : (isOfflinePending ? "Will analyze when online" : "AI is analyzing content...")) : (memory.transcription || memory.content)}
                    </p>
                )}
            </div>

            {isExpanded && !isPending && !isSelectionMode && (
                <div className="px-4 py-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative z-10">
                    <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 relative group/media">
                        {memory.type === MediaType.IMAGE && (
                            <div onClick={(e) => { e.stopPropagation(); onViewMedia(memory); }} className="relative cursor-zoom-in group-hover/media:opacity-95 transition-opacity">
                                <img src={memory.content} alt="Memory" className="w-full h-auto max-h-[400px] object-contain" />
                                <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity">
                                    <Maximize2 size={16} />
                                </div>
                            </div>
                        )}
                        {memory.type === MediaType.VIDEO && (
                            <div className="relative">
                                <video src={memory.content} controls className="w-full max-h-[400px]" />
                                <button onClick={(e) => { e.stopPropagation(); onViewMedia(memory); }} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity z-20">
                                    <Maximize2 size={16} />
                                </button>
                            </div>
                        )}
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
  const [isOnline, setIsOnline] = useState(true);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<MediaType | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'DATE' | 'FAVORITES' | 'PINNED'>('DATE');
  const [searchQuery, setSearchQuery] = useState("");
  
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
  
  // Media Viewer State
  const [viewingMedia, setViewingMedia] = useState<MemoryItem | null>(null);

  const observerTarget = useRef(null);

  useEffect(() => { 
      const settings = getSettings();
      setLanguage(settings.language || 'ar-SA');

      const unsubscribe = offlineService.subscribe((online) => setIsOnline(online));
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen for sync complete events to reload memories
    const handleSyncComplete = () => loadMemories(true);
    window.addEventListener('thakira-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('thakira-sync-complete', handleSyncComplete);
  }, [filterType, timeFilter, showFavoritesOnly, showPinnedOnly, sortBy, searchQuery]);

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

  const handleDelete = async (id: string) => { if (confirm("هل أنت متأكد من حذف هذه الذكرى؟")) { await deleteMemory(id); await reminderService.cancelNotification(id); setMemories(prev => prev.filter(m => m.id !== id)); } };
  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); const memory = memories.find(m => m.id === id); if (!memory) return; const updated = { ...memory, isFavorite: !memory.isFavorite }; setMemories(prev => prev.map(m => m.id === id ? updated : m)); await saveMemory(updated); };
  const handleTogglePin = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); const memory = memories.find(m => m.id === id); if (!memory) return; const updated = { ...memory, isPinned: !memory.isPinned }; setMemories(prev => prev.map(m => m.id === id ? updated : m)); await saveMemory(updated); };
  
  const handleReAnalyze = async (e: React.MouseEvent, memory: MemoryItem) => {
      e.stopPropagation(); if (!memory) return;
      
      const pending: DisplayMemory = { ...memory, analysisStatus: 'PENDING', summary: language.startsWith('ar') ? "جاري إعادة التحليل..." : "Analyzing..." };
      setMemories(prev => prev.map(m => m.id === memory.id ? pending : m));
      await saveMemory(pending);

      try {
        const context = memory.metadata?.userContext || "";
        const analysis = await analyzeMedia(memory.type, memory.content, context);
        
        let finalReminder = memory.reminder;
        if (!finalReminder && analysis.detectedReminder) {
            finalReminder = {
                timestamp: new Date(analysis.detectedReminder.isoTimestamp).getTime(),
                frequency: analysis.detectedReminder.frequency,
                interval: analysis.detectedReminder.interval || 1
            };
        }

        const updated: DisplayMemory = {
            ...memory,
            transcription: analysis.transcription,
            summary: analysis.summary,
            tags: analysis.tags,
            reminder: finalReminder,
            analysisStatus: 'COMPLETED'
        };

        await saveMemory(updated);
        if (finalReminder) await reminderService.scheduleNotification(updated);
        setMemories(prev => prev.map(m => m.id === memory.id ? updated : m));

      } catch (error) {
         const failed: DisplayMemory = { ...memory, analysisStatus: 'FAILED', summary: "فشل التحليل" };
         setMemories(prev => prev.map(m => m.id === memory.id ? failed : m));
         await saveMemory(failed);
      }
  };

  const handleExportPDF = (e: React.MouseEvent, memory: MemoryItem) => {
      e.stopPropagation();
      setPrintableMemories([memory]);
  };

  const handleBulkExport = () => {
      const selected = memories.filter(m => selectedIds.has(m.id));
      if (selected.length > 0) setPrintableMemories(selected);
      setIsSelectionMode(false);
      setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
      if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} عنصر؟`)) return;
      for (const id of selectedIds) {
          await deleteMemory(id);
          await reminderService.cancelNotification(id);
      }
      setMemories(prev => prev.filter(m => !selectedIds.has(m.id)));
      setIsSelectionMode(false);
      setSelectedIds(new Set());
  };

  const handleSetReminder = (e: React.MouseEvent, memory: MemoryItem) => {
      e.stopPropagation();
      setSelectedMemoryId(memory.id);
      if (memory.reminder) {
          const date = new Date(memory.reminder.timestamp);
          const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
          setReminderDate(isoString);
          setReminderFreq(memory.reminder.frequency);
          setReminderInterval(memory.reminder.interval || 1);
      } else {
          setReminderDate("");
          setReminderFreq('ONCE');
          setReminderInterval(1);
      }
      setReminderModalOpen(true);
  };

  const saveReminder = async () => {
      if (!selectedMemoryId || !reminderDate) return;
      const memory = memories.find(m => m.id === selectedMemoryId);
      if (!memory) return;
      
      const newReminder: Reminder = {
          timestamp: new Date(reminderDate).getTime(),
          frequency: reminderFreq,
          interval: reminderInterval
      };
      
      const updated = { ...memory, reminder: newReminder };
      await saveMemory(updated);
      await reminderService.scheduleNotification(updated);

      setMemories(prev => prev.map(m => m.id === selectedMemoryId ? updated : m));
      setReminderModalOpen(false);
  };

  const toggleSelect = (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      setSelectedIds(next);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === memories.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(memories.map(m => m.id)));
  };

  return (
    <div className="flex flex-col h-full bg-dark relative">
        {/* Media Viewer Modal */}
        {viewingMedia && (
            <MediaViewer memory={viewingMedia} onClose={() => setViewingMedia(null)} />
        )}

        {/* Print Template (Hidden unless printing) */}
        {printableMemories && (
            <div id="print-container" className="hidden">
                 <div className="p-8 max-w-4xl mx-auto bg-white text-black">
                     <div className="flex items-center justify-between border-b pb-4 mb-6">
                         <div className="flex items-center gap-2">
                             <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl">Th</div>
                             <h1 className="text-2xl font-bold">الذاكرة الذكية - تقرير</h1>
                         </div>
                         <p className="text-sm text-gray-500">{new Date().toLocaleDateString('ar-SA')} - {printableMemories.length} ذكريات</p>
                     </div>
                     <div className="space-y-6">
                         {printableMemories.map((m) => (
                             <div key={m.id} className="border border-gray-200 rounded-lg p-4 break-inside-avoid page-break">
                                 <div className="flex items-start justify-between mb-2">
                                     <div className="flex items-center gap-2">
                                         <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{m.type}</span>
                                         <span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString('ar-SA')}</span>
                                     </div>
                                 </div>
                                 {m.type === MediaType.IMAGE && <img src={m.content} className="w-48 h-48 object-cover rounded-lg mb-4 border" />}
                                 <h2 className="text-lg font-bold mb-2">{m.summary || "بدون عنوان"}</h2>
                                 <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{m.transcription || m.content}</p>
                                 {m.tags && m.tags.length > 0 && (
                                     <div className="mt-2 flex gap-1">
                                         {m.tags.map((t, i) => <span key={i} className="text-xs text-gray-500">#{t}</span>)}
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 </div>
            </div>
        )}

         {/* Unified Header */}
        <div className={`print:hidden sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-4 pt-4 pb-2 shadow-sm space-y-3 transition-colors duration-300 ${isSelectionMode ? 'bg-primary/10 border-primary/20' : ''}`}>
             <div className="flex justify-between items-center h-10">
                 {isSelectionMode ? (
                     <div className="flex items-center gap-3 w-full animate-in slide-in-from-top-2">
                         <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"><X size={20}/></button>
                         <span className="font-bold text-lg">{selectedIds.size} محدد</span>
                         <div className="flex-1" />
                         <button onClick={toggleSelectAll} className="text-xs font-bold text-primary px-3 py-1.5 bg-white dark:bg-black/20 rounded-lg">{selectedIds.size === memories.length ? 'إلغاء الكل' : 'تحديد الكل'}</button>
                     </div>
                 ) : (
                    <>
                        <h2 className="text-xl font-bold text-foreground">ذكرياتي</h2>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSelectionMode(true)} className="p-2 text-gray-400 hover:text-primary transition-colors"><CheckSquare size={20} /></button>
                        </div>
                    </>
                 )}
             </div>

             {/* Filters Bar */}
             {!isSelectionMode && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
                     {[{ id: 'ALL', icon: MoreVertical, label: 'الكل' }, { id: MediaType.AUDIO, icon: Play, label: 'صوت' }, { id: MediaType.VIDEO, icon: Video, label: 'فيديو' }, { id: MediaType.IMAGE, icon: Image, label: 'صور' }, { id: MediaType.TEXT, icon: FileText, label: 'نصوص' }].map((f) => (
                         <button key={f.id} onClick={() => setFilterType(f.id as any)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border whitespace-nowrap transition-all ${filterType === f.id ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400'}`}>
                             <f.icon size={14} /> <span className="text-xs font-bold">{f.label}</span>
                         </button>
                     ))}
                     <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1 shrink-0" />
                     <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`p-2 rounded-xl border transition-all ${showFavoritesOnly ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-400'}`}><Star size={16} fill={showFavoritesOnly ? "currentColor" : "none"} /></button>
                     <button onClick={() => setShowPinnedOnly(!showPinnedOnly)} className={`p-2 rounded-xl border transition-all ${showPinnedOnly ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-400'}`}><Pin size={16} fill={showPinnedOnly ? "currentColor" : "none"} /></button>
                </div>
             )}
        </div>

        {/* Content List */}
        <div className="print:hidden p-4 space-y-4 overflow-y-auto flex-1 pb-24 relative">
             {loading ? (
                 <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                     <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                     <p className="text-xs text-gray-500">جاري تحميل الذكريات...</p>
                 </div>
             ) : memories.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 opacity-50 text-center px-6">
                     <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400">
                         <Search size={32} />
                     </div>
                     <p className="text-sm font-bold text-foreground">لا توجد ذكريات</p>
                     <p className="text-xs text-gray-500 mt-1">ابدأ بتسجيل لحظاتك الجميلة الآن!</p>
                 </div>
             ) : (
                 <>
                    {memories.map((memory) => (
                        <MemoryCard 
                            key={memory.id} 
                            memory={memory} 
                            isPlaying={playingId === memory.id} 
                            onTogglePlay={(id) => setPlayingId(playingId === id ? null : id)}
                            onToggleFavorite={handleToggleFavorite}
                            onTogglePin={handleTogglePin}
                            onDelete={handleDelete}
                            onSetReminder={handleSetReminder}
                            onExportPDF={handleExportPDF}
                            onReAnalyze={handleReAnalyze}
                            onViewMedia={setViewingMedia}
                            isHighlighted={highlightedMemoryId === memory.id}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(memory.id)}
                            onSelect={toggleSelect}
                            language={language}
                            isOnline={isOnline}
                        />
                    ))}
                    <div ref={observerTarget} className="h-10 flex items-center justify-center opacity-50">
                        {loadingMore && <Loader2 size={20} className="animate-spin text-primary" />}
                    </div>
                 </>
             )}
        </div>

        {/* Bulk Action Bar */}
        {isSelectionMode && selectedIds.size > 0 && (
            <div className="absolute bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-2 flex items-center justify-around border border-gray-200 dark:border-white/10">
                    <button onClick={handleBulkExport} className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
                        <Printer size={20} />
                        <span className="text-[10px] font-bold">PDF</span>
                    </button>
                    <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                    <button onClick={handleBulkDelete} className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={20} />
                        <span className="text-[10px] font-bold">حذف</span>
                    </button>
                </div>
            </div>
        )}

        {/* Export Progress Modal */}
        {isExporting && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm print:hidden">
                 <div className="bg-white dark:bg-card p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center">
                     <div className="relative w-20 h-20 flex items-center justify-center">
                         <svg className="w-full h-full transform -rotate-90">
                             <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-100 dark:text-white/5" />
                             <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={226} strokeDashoffset={226 - (226 * exportProgress) / 100} className="text-primary transition-all duration-300" />
                         </svg>
                         <Printer size={32} className="absolute text-primary animate-pulse" />
                     </div>
                     <div>
                         <h3 className="text-lg font-bold text-foreground">جاري تحضير الملف...</h3>
                         <p className="text-sm text-gray-500 mt-1">{exportProgress}% مكتمل</p>
                     </div>
                 </div>
             </div>
        )}

        {/* Reminder Modal */}
        {reminderModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
                <div className="bg-white dark:bg-card w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-foreground">ضبط تذكير</h3>
                        <button onClick={() => setReminderModalOpen(false)} className="text-gray-400 hover:text-foreground"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-500">الوقت والتاريخ</label>
                             <input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-foreground" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 block">التكرار</label>
                            <div className="flex gap-2 flex-wrap">
                                {['ONCE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map(freq => (
                                    <button key={freq} onClick={() => setReminderFreq(freq as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${reminderFreq === freq ? 'bg-primary/10 border-primary text-primary' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-500'}`}>
                                        {freq === 'ONCE' ? 'مرة' : freq === 'HOURLY' ? 'ساعة' : freq === 'DAILY' ? 'يوم' : freq === 'WEEKLY' ? 'أسبوع' : freq === 'MONTHLY' ? 'شهر' : 'سنة'}
                                    </button>
                                ))}
                            </div>
                            {reminderFreq !== 'ONCE' && (
                                <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/10 mt-2">
                                    <label className="text-xs font-bold text-gray-500 whitespace-nowrap">كل</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="100" 
                                        value={reminderInterval} 
                                        onChange={(e) => setReminderInterval(parseInt(e.target.value) || 1)} 
                                        className="w-16 text-center bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-1 text-sm font-bold text-foreground"
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
                        <button onClick={saveReminder} className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-4">حفظ التذكير</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};