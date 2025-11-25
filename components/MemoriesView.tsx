
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPagedMemories, deleteMemory, saveMemory, FilterOptions, getMemories, getMemoryById } from '../services/db';
import { MemoryItem, MediaType, ReminderFrequency, Reminder } from '../types';
import { generateGoogleCalendarLink } from '../services/calendarService';
import { Play, FileText, Image, Trash2, Video, Pause, Search, Filter, MoreVertical, FileJson, FileSpreadsheet, X, Clock, ChevronLeft, Star, Bell, Calendar, ChevronDown, ChevronUp, ArrowUpDown, Loader2, CalendarDays, Pin, PinOff, Check, FileDown } from 'lucide-react';

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
    isHighlighted?: boolean;
}

const formatRelativeTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Normalize to start of day for accurate day diff
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    
    const diffMs = startOfToday - startOfDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'اليوم';
    if (diffDays === 1) return 'أمس';
    if (diffDays === 2) return 'قبل يومين';
    if (diffDays > 2 && diffDays <= 7) return `منذ ${diffDays} أيام`;
    
    // For older dates, show full date
    return date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' });
};

const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MemoryCard: React.FC<MemoryCardProps> = ({ 
    id, memory, isPlaying, onTogglePlay, onToggleFavorite, onTogglePin, onDelete, onSetReminder, onExportPDF, isHighlighted
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Audio State
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (isHighlighted) {
            setIsExpanded(true);
        }
    }, [isHighlighted]);

    // Handle Audio Playback based on Prop
    useEffect(() => {
        if (memory.type !== MediaType.AUDIO || !audioRef.current) return;

        if (isPlaying) {
            audioRef.current.play().catch(e => console.error("Playback error:", e));
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying, memory.type]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
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
            case MediaType.AUDIO: return { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' };
            case MediaType.VIDEO: return { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' };
            case MediaType.IMAGE: return { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' };
            default: return { text: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' };
        }
    };

    const styles = getTypeStyles();

    // Determine Container Styles based on State
    let containerClasses = "group backdrop-blur border rounded-2xl overflow-hidden transition-all duration-300 shadow-md hover:shadow-lg relative ";
    
    if (isHighlighted) {
        containerClasses += "border-primary ring-2 ring-primary/50 bg-card/90 z-10";
    } else if (memory.isPinned) {
        // Pinned Style: Distinct Cyan/Teal border with glow
        containerClasses += "border-cyan-500/60 bg-gradient-to-br from-card/90 via-card/80 to-cyan-500/10 shadow-[0_0_20px_-5px_rgba(6,182,212,0.25)] z-10 ring-1 ring-cyan-500/20";
    } else if (isExpanded) {
        containerClasses += "bg-card/90 border-primary/20 ring-1 ring-primary/20 z-10";
    } else if (memory.reminder) {
        // Reminder Style: Enhanced Purple border with stronger shadow and gradient
        containerClasses += "border-secondary/80 shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)] bg-gradient-to-br from-card/80 to-secondary/10 z-10";
    } else {
        containerClasses += "border-white/5 hover:border-white/10 bg-card/50";
    }

    return (
        <div 
            id={id}
            onClick={() => setIsExpanded(!isExpanded)}
            className={containerClasses}
        >
            {/* Visual Indicator for Reminder - pulsing border overlay */}
             {memory.reminder && !isHighlighted && !memory.isPinned && (
                <div className="absolute inset-0 rounded-2xl border border-secondary/40 animate-[pulse_3s_infinite] pointer-events-none shadow-[inset_0_0_20px_rgba(168,85,247,0.1)]" />
            )}

            {/* Visual Indicator for Pinned */}
            {memory.isPinned && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"></div>
            )}

            {/* Header Section */}
            <div className="p-4 pb-2 flex justify-between items-start relative z-10">
                 <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl border ${styles.border} ${styles.bg} ${styles.text} flex items-center justify-center shrink-0`}>
                         {getIcon()}
                     </div>
                     <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-300 font-bold">
                                {memory.type === MediaType.AUDIO ? 'تسجيل صوتي' : memory.type === MediaType.VIDEO ? 'فيديو' : memory.type === MediaType.IMAGE ? 'صورة' : 'نص'}
                            </span>
                             {memory.reminder && (
                                <div className="flex items-center gap-1.5 bg-secondary/20 text-secondary border border-secondary/30 text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                                    <Bell size={10} fill="currentColor" />
                                    <span className="font-bold font-mono tracking-tight">{new Date(memory.reminder.timestamp).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            )}
                         </div>
                         <span className="text-[10px] text-gray-500 mt-0.5 font-medium flex items-center gap-1">
                            <Clock size={10} />
                            {formatRelativeTime(memory.createdAt)}
                         </span>
                     </div>
                 </div>

                 {/* Match Score Badge (Search Mode) or Pin Icon */}
                 {memory.matchScore !== undefined ? (
                    <div className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                        {memory.matchScore}%
                    </div>
                 ) : memory.isPinned ? (
                     <div className="text-cyan-400 bg-cyan-400/10 p-1.5 rounded-full border border-cyan-400/20">
                         <Pin size={12} fill="currentColor" />
                     </div>
                 ) : null}
            </div>

            {/* Summary Section (Card Body) */}
            <div className="px-4 py-1 relative z-10">
                <h3 className={`font-bold text-gray-200 leading-relaxed transition-all duration-300 ${isExpanded ? 'text-lg mb-2' : 'text-sm line-clamp-1'}`}>
                    {memory.summary || "بدون عنوان"}
                </h3>
                
                {/* Collapsed Content Snippet */}
                {!isExpanded && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {memory.transcription || memory.content}
                    </p>
                )}
            </div>

            {/* Expanded Content Area */}
            {isExpanded && (
                <div className="px-4 py-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative z-10">
                    
                    {/* Media Viewer */}
                    <div className="rounded-xl overflow-hidden bg-black/30 border border-white/5">
                        {memory.type === MediaType.IMAGE && (
                            <img src={memory.content} alt="Memory" className="w-full h-auto max-h-[400px] object-contain" />
                        )}
                        {memory.type === MediaType.VIDEO && (
                            <video src={memory.content} controls className="w-full max-h-[400px]" />
                        )}
                        {memory.type === MediaType.AUDIO && (
                            <div className="p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onTogglePlay(memory.id); }}
                                        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform shrink-0"
                                    >
                                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                                    </button>
                                    
                                    <div className="flex-1 flex flex-col justify-center">
                                        {/* Seek Bar */}
                                        <input
                                            type="range"
                                            min={0}
                                            max={duration || 100}
                                            value={currentTime}
                                            onChange={handleSeek}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                                            <span>{formatDuration(currentTime)}</span>
                                            <span>{formatDuration(duration)}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Hidden Audio Element */}
                                <audio 
                                    ref={audioRef}
                                    src={memory.content} 
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onEnded={() => {
                                        onTogglePlay(memory.id); 
                                    }} 
                                    className="hidden" 
                                />
                            </div>
                        )}
                    </div>

                    {/* Full Text Content */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                            <FileText size={12} />
                            <span>التفاصيل الكاملة</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-loose whitespace-pre-wrap">
                            {memory.transcription || memory.content}
                        </p>
                    </div>

                    {/* Add to Calendar Button (if reminder exists) */}
                    {memory.reminder && (
                         <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 generateGoogleCalendarLink(memory);
                             }}
                             className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 py-2 rounded-lg text-xs transition-colors"
                         >
                             <CalendarDays size={14} className="text-blue-400" />
                             إضافة لتقويم جوجل
                         </button>
                    )}
                </div>
            )}

            {/* Footer: Tags & Actions */}
            <div className="px-4 py-3 mt-2 border-t border-white/5 flex flex-col gap-3 relative z-10">
                {/* Relevant Tags */}
                {memory.tags && memory.tags.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                        {memory.tags.map((tag, idx) => (
                            <span key={idx} className="text-[10px] text-secondary bg-secondary/5 border border-secondary/20 px-2 py-1 rounded-md">
                                #{tag.replace(/\s+/g, '_')}
                            </span>
                        ))}
                    </div>
                )}

                {/* Actions Row */}
                <div className="flex justify-between items-center pt-1">
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => onSetReminder(e, memory)}
                            className={`p-2 rounded-full transition-all ${memory.reminder ? 'text-secondary bg-secondary/10' : 'text-gray-500 hover:text-secondary hover:bg-white/5'}`}
                            title="ضبط تذكير"
                        >
                            <Bell size={18} fill={memory.reminder ? "currentColor" : "none"} />
                        </button>
                        <button 
                            onClick={(e) => onExportPDF(e, memory)}
                            className="p-2 rounded-full text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                            title="تصدير PDF"
                        >
                            <FileDown size={18} />
                        </button>
                        <button 
                            onClick={(e) => onToggleFavorite(e, memory.id)}
                            className={`p-2 rounded-full transition-all ${memory.isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-white/5'}`}
                            title="المفضلة"
                        >
                            <Star size={18} fill={memory.isFavorite ? "currentColor" : "none"} />
                        </button>
                        <button 
                            onClick={(e) => onTogglePin(e, memory.id)}
                            className={`p-2 rounded-full transition-all ${memory.isPinned ? 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'text-gray-500 hover:text-cyan-400 hover:bg-white/5'}`}
                            title={memory.isPinned ? "إلغاء التثبيت" : "تثبيت"}
                        >
                            {memory.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(memory.id); }}
                            className="p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="حذف"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <button className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors px-2 py-1">
                        {isExpanded ? (
                            <>
                                <span>عرض أقل</span>
                                <ChevronUp size={14} />
                            </>
                        ) : (
                            <>
                                <span>عرض التفاصيل</span>
                                <ChevronDown size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            {/* Hidden Audio Player Logic (Fallback/Init) */}
             {memory.type === MediaType.AUDIO && (
                <audio id={`audio-${memory.id}`} src={memory.content} className="hidden" />
            )}
        </div>
    );
};

interface MemoriesViewProps {
    highlightedMemoryId?: string | null;
}

export const MemoriesView: React.FC<MemoriesViewProps> = ({ highlightedMemoryId }) => {
  // State for Memories & Pagination
  const [memories, setMemories] = useState<DisplayMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<{ value: any; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filters State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<MediaType | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('ALL');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'DATE' | 'FAVORITES' | 'PINNED'>('DATE');
  const [searchQuery, setSearchQuery] = useState("");
  
  // UI State
  const [showMenu, setShowMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  
  // Reminder Modal State
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderFreq, setReminderFreq] = useState<ReminderFrequency>('ONCE');

  // Print State
  const [printableMemories, setPrintableMemories] = useState<MemoryItem[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Infinite Scroll Ref
  const observerTarget = useRef(null);

  // Handle Highlighted Memory Logic
  useEffect(() => {
    if (highlightedMemoryId) {
        handleHighlight(highlightedMemoryId);
    }
  }, [highlightedMemoryId]);

  const handleHighlight = async (id: string) => {
    // Check if already in view
    const exists = memories.find(m => m.id === id);
    if (!exists) {
        try {
            const memory = await getMemoryById(id);
            if (memory) {
                setMemories(prev => [memory as DisplayMemory, ...prev]);
            }
        } catch (e) {
            console.error("Failed to fetch highlighted memory", e);
        }
    }

    // Delay slighty to allow render
    setTimeout(() => {
        const el = document.getElementById(`memory-card-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 200);
  };

  // Reset and Load on Filters Change
  useEffect(() => {
      setMemories([]);
      setCursor(null);
      setHasMore(true);
      loadMemories(true);
  }, [filterType, timeFilter, showFavoritesOnly, showPinnedOnly, sortBy, searchQuery]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMemories(false);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [hasMore, loading, loadingMore, cursor]);

  // Trigger Print when data is ready with progress simulation
  useEffect(() => {
    if (printableMemories && printableMemories.length > 0) {
        setIsExporting(true);
        setExportProgress(0);

        // Simulate preparation time (processing images/layout)
        let currentStep = 0;
        const totalSteps = 20; // 20 * 50ms = 1 second approx
        const interval = setInterval(() => {
            currentStep++;
            const pct = Math.min(Math.round((currentStep / totalSteps) * 100), 100);
            setExportProgress(pct);

            if (currentStep >= totalSteps) {
                clearInterval(interval);
                // Slight delay at 100% to ensure UI updates before blocking print dialog opens
                setTimeout(() => {
                    window.print();
                }, 200);
            }
        }, 50);

        return () => clearInterval(interval);
    }
  }, [printableMemories]);

  // Cleanup print state after print
  useEffect(() => {
      const handleAfterPrint = () => {
          setPrintableMemories(null);
          setIsExporting(false);
          setExportProgress(0);
      };
      window.addEventListener("afterprint", handleAfterPrint);
      return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const loadMemories = async (reset: boolean) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
        const filters: FilterOptions = {
            type: filterType,
            timeFilter,
            showFavoritesOnly,
            showPinnedOnly,
            searchQuery,
            sortBy
        };

        const result = await getPagedMemories(
            15, // Page Size
            reset ? null : cursor,
            filters
        );

        // Calculate score if searching (Client side scoring for display, though filter happened in DB)
        const newItems: DisplayMemory[] = result.items.map(item => {
            if (!searchQuery) return item;
            
            // Simple scoring for visual feedback
            let score = 0;
            const q = searchQuery.toLowerCase();
            if (item.summary?.toLowerCase().includes(q)) score += 50;
            if (item.transcription?.toLowerCase().includes(q)) score += 30;
            if (item.tags?.some(t => t.toLowerCase().includes(q))) score += 40;
            
            return { ...item, matchScore: Math.min(score, 100) };
        });

        if (reset) {
            setMemories(newItems);
        } else {
            // Deduplicate in case highlighter added it
            setMemories(prev => {
                const combined = [...prev, ...newItems];
                return Array.from(new Map(combined.map(item => [item.id, item])).values());
            });
        }

        setCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);

    } catch (error) {
        console.error("Failed to load memories", error);
    } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الذكرى؟")) {
      await deleteMemory(id);
      setMemories(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const memory = memories.find(m => m.id === id);
      if (!memory) return;

      const updatedMemory = { ...memory, isFavorite: !memory.isFavorite };
      setMemories(prev => prev.map(m => m.id === id ? updatedMemory : m));
      await saveMemory(updatedMemory);
  };

  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const memory = memories.find(m => m.id === id);
      if (!memory) return;

      const updatedMemory = { ...memory, isPinned: !memory.isPinned };
      setMemories(prev => prev.map(m => m.id === id ? updatedMemory : m));
      await saveMemory(updatedMemory);
  };

  const handleExportPDF = async (e: React.MouseEvent, memory?: MemoryItem) => {
      e.stopPropagation();
      setShowMenu(false);
      
      if (memory) {
          // Export single memory
          setPrintableMemories([memory]);
      } else {
          // Export all currently visible memories
          setLoading(true);
          try {
             setPrintableMemories(memories);
          } finally {
              setLoading(false);
          }
      }
  };

  // Open Reminder Modal for specific memory
  const openReminderModal = (e: React.MouseEvent, memory: MemoryItem) => {
      e.stopPropagation();
      setSelectedMemoryId(memory.id);
      
      if (memory.reminder) {
          const date = new Date(memory.reminder.timestamp);
          const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
          setReminderDate(isoString);
          setReminderFreq(memory.reminder.frequency);
      } else {
          setReminderDate("");
          setReminderFreq('ONCE');
      }
      setReminderModalOpen(true);
  };

  const saveReminder = async () => {
      if (!selectedMemoryId) return;
      const memory = memories.find(m => m.id === selectedMemoryId);
      if (!memory) return;

      let updatedReminder: Reminder | undefined;
      
      if (reminderDate) {
          updatedReminder = {
              timestamp: new Date(reminderDate).getTime(),
              frequency: reminderFreq
          };
      }

      const updatedMemory = { ...memory, reminder: updatedReminder };
      
      setMemories(prev => prev.map(m => m.id === selectedMemoryId ? updatedMemory : m));
      await saveMemory(updatedMemory);
      setReminderModalOpen(false);
  };

  const togglePlay = (id: string) => {
      if (playingId === id) {
          setPlayingId(null);
          const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
          if (audio) audio.pause();
      } else {
          if (playingId) {
             const prev = document.getElementById(`audio-${playingId}`) as HTMLAudioElement;
             if(prev) prev.pause();
          }
          setPlayingId(id);
          const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
          if (audio) {
              audio.currentTime = 0;
              audio.play();
          }
      }
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    setShowMenu(false);
  };

  const exportJSON = async () => {
    const allMemories = await getMemories(); // Export needs ALL items
    const dataStr = JSON.stringify(allMemories, null, 2);
    downloadFile(dataStr, `thakira_backup_${Date.now()}.json`, 'application/json');
  };

  const exportCSV = async () => {
    const allMemories = await getMemories(); // Export needs ALL items
    let csvContent = "\uFEFF"; 
    csvContent += "ID,Date,Type,IsFavorite,IsPinned,Summary,Tags,Transcription\n";
    allMemories.forEach(m => {
        const date = new Date(m.createdAt).toLocaleDateString('ar-SA');
        const tags = m.tags ? m.tags.join(";") : "";
        const cleanSummary = (m.summary || "").replace(/,/g, "،").replace(/\n/g, " ");
        const cleanTrans = (m.transcription || "").replace(/,/g, "،").replace(/\n/g, " ");
        const fav = m.isFavorite ? "Yes" : "No";
        const pin = m.isPinned ? "Yes" : "No";
        csvContent += `"${m.id}","${date}","${m.type}","${fav}","${pin}","${cleanSummary}","${tags}","${cleanTrans}"\n`;
    });
    downloadFile(csvContent, `thakira_report_${Date.now()}.csv`, 'text/csv');
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: MediaType | 'ALL', label: string, icon: any }) => (
      <button 
        onClick={() => setFilterType(type)}
        title={label}
        className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${
            filterType === type 
            ? 'bg-white text-dark shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110 z-10' 
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white hover:scale-105'
        }`}
      >
          <Icon size={16} />
      </button>
  );

  return (
    <div className="flex flex-col h-full bg-dark relative" onClick={() => { showMenu && setShowMenu(false); }}>
      {/* Header & Filter */}
      <div className="sticky top-0 z-30 bg-dark/95 backdrop-blur border-b border-white/5 p-4 space-y-3 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between h-10">
            {isSearchOpen ? (
                <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-2 fade-in duration-200">
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ابحث..."
                            autoFocus
                            className="w-full bg-white/10 border border-white/10 rounded-lg py-2 px-3 pl-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute left-2 top-2 text-gray-400">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-gray-400 p-1">
                        <ChevronLeft size={20} className="rtl:rotate-180" />
                    </button>
                </div>
            ) : (
                <>
                    <h2 className="text-xl font-bold text-white">شريط الذكريات</h2>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
                             <Search size={20} />
                        </button>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-md">{memories.length}+</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            className="p-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors"
                        >
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </>
            )}
          </div>
          
          {showMenu && (
              <div className="absolute top-16 left-4 z-50 bg-card border border-white/10 rounded-xl shadow-2xl p-2 w-48 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-xs text-gray-500 font-bold px-3 py-2 flex items-center gap-2">
                     <ArrowUpDown size={12} />
                     ترتيب حسب
                  </div>
                  
                  <button onClick={() => setSortBy('DATE')} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${sortBy === 'DATE' ? 'bg-primary/20 text-primary' : 'text-gray-200 hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <Clock size={16} />
                        <span>الأحدث (افتراضي)</span>
                      </div>
                      {sortBy === 'DATE' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>

                  <button onClick={() => setSortBy('FAVORITES')} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${sortBy === 'FAVORITES' ? 'bg-primary/20 text-primary' : 'text-gray-200 hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <Star size={16} />
                        <span>المفضلة أولاً</span>
                      </div>
                      {sortBy === 'FAVORITES' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>

                  <button onClick={() => setSortBy('PINNED')} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${sortBy === 'PINNED' ? 'bg-primary/20 text-primary' : 'text-gray-200 hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <Pin size={16} />
                        <span>المثبتة أولاً</span>
                      </div>
                      {sortBy === 'PINNED' && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>

                  <div className="h-px bg-white/10 my-2" />
                  <div className="text-xs text-gray-500 font-bold px-3 py-2">تصدير</div>
                  <button onClick={(e) => handleExportPDF(e)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm text-gray-200 text-right transition-colors">
                      <FileDown size={16} className="text-blue-400" />
                      مستند (PDF)
                  </button>
                  <button onClick={exportJSON} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm text-gray-200 text-right transition-colors">
                      <FileJson size={16} className="text-yellow-400" />
                      نسخة كاملة (JSON)
                  </button>
                  <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-sm text-gray-200 text-right transition-colors">
                      <FileSpreadsheet size={16} className="text-green-400" />
                      جدول بيانات (CSV)
                  </button>
              </div>
          )}

          <div className={`transition-all duration-300 overflow-hidden ${isSearchOpen ? 'h-0 opacity-0' : 'h-auto opacity-100'}`}>
             <div className="w-full overflow-x-auto pb-2 pt-1 px-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                <div className="flex items-center gap-2 min-w-max">
                     {/* Status Filters Group */}
                     <div className="flex items-center gap-2 shrink-0">
                        <button 
                            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                            title="المثبتة"
                            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all border ${
                                showPinnedOnly 
                                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            <Pin size={16} fill={showPinnedOnly ? "currentColor" : "none"} />
                        </button>

                        <button 
                            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                            title="المفضلة"
                            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all border ${
                                showFavoritesOnly 
                                ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            <Star size={16} fill={showFavoritesOnly ? "currentColor" : "none"} />
                        </button>
                     </div>

                    <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />
                    
                    {/* Type Filters Group */}
                    <div className="flex items-center gap-2 shrink-0">
                        <FilterButton type="ALL" label="الكل" icon={Filter} />
                        <FilterButton type={MediaType.AUDIO} label="صوت" icon={Play} />
                        <FilterButton type={MediaType.VIDEO} label="فيديو" icon={Video} />
                        <FilterButton type={MediaType.IMAGE} label="صور" icon={Image} />
                        <FilterButton type={MediaType.TEXT} label="نص" icon={FileText} />
                    </div>

                    <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />

                    {/* Time Filters Group - Dropdown */}
                    <div 
                        className="relative flex items-center shrink-0"
                        onMouseEnter={() => setShowTimeMenu(true)}
                        onMouseLeave={() => setShowTimeMenu(false)}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowTimeMenu(!showTimeMenu); }}
                            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${
                                timeFilter !== 'ALL'
                                ? 'bg-secondary text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                            title="تصفية الوقت"
                        >
                            <Clock size={16} />
                        </button>

                        {/* Dropdown */}
                        <div className={`absolute top-full left-0 mt-2 w-32 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden transition-all duration-200 z-50 ${showTimeMenu ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-2 invisible'}`}>
                            <div className="flex flex-col p-1">
                                {[
                                    { type: 'ALL', label: 'كل الأوقات' },
                                    { type: 'TODAY', label: 'اليوم' },
                                    { type: 'WEEK', label: 'هذا الأسبوع' },
                                    { type: 'MONTH', label: 'هذا الشهر' },
                                    { type: 'YEAR', label: 'هذه السنة' },
                                ].map((opt) => (
                                    <button
                                        key={opt.type}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTimeFilter(opt.type as any);
                                            setShowTimeMenu(false);
                                        }}
                                        className={`w-full text-right px-3 py-2 text-xs font-medium transition-all rounded-lg ${
                                            timeFilter === opt.type 
                                            ? 'bg-secondary/20 text-secondary' 
                                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          </div>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {loading && memories.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-gray-500 text-sm">جاري تحميل الذكريات...</p>
           </div>
        ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 opacity-60">
                <Search size={48} className="mb-4 stroke-1" />
                <p>{searchQuery ? 'لا توجد نتائج مطابقة لبحثك.' : 'لا توجد ذكريات في هذا التصنيف.'}</p>
                {(filterType !== 'ALL' || timeFilter !== 'ALL' || searchQuery || showFavoritesOnly || showPinnedOnly) && (
                    <button 
                        onClick={() => { setFilterType('ALL'); setTimeFilter('ALL'); setSearchQuery(''); setIsSearchOpen(false); setShowFavoritesOnly(false); setShowPinnedOnly(false); }}
                        className="mt-4 text-xs text-primary hover:underline"
                    >
                        مسح الفلاتر والبحث
                    </button>
                )}
            </div>
        ) : (
            <>
                {memories.map((mem: DisplayMemory) => (
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
                        isHighlighted={highlightedMemoryId === mem.id}
                    />
                ))}
                
                {/* Infinite Scroll Trigger & Loader */}
                <div ref={observerTarget} className="h-20 flex items-center justify-center">
                    {loadingMore && <Loader2 className="animate-spin text-gray-500" size={24} />}
                    {!hasMore && memories.length > 5 && (
                        <span className="text-xs text-gray-600">وصلت لنهاية الذكريات</span>
                    )}
                </div>
            </>
        )}
      </div>

       {/* Shared Reminder Modal */}
       {reminderModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setReminderModalOpen(false)}>
                <div className="bg-card w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Calendar size={18} className="text-secondary" />
                            تذكير بالذكرى
                        </h3>
                        <button onClick={() => setReminderModalOpen(false)} className="text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs text-gray-400">تاريخ ووقت التذكير</label>
                            <input 
                                type="datetime-local" 
                                value={reminderDate}
                                onChange={(e) => setReminderDate(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-gray-400">التكرار</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map((freq) => (
                                    <button
                                        key={freq}
                                        onClick={() => setReminderFreq(freq as ReminderFrequency)}
                                        className={`text-xs py-2 rounded-lg border transition-all ${
                                            reminderFreq === freq 
                                            ? 'bg-secondary/20 border-secondary text-secondary' 
                                            : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {freq === 'ONCE' ? 'مرة واحدة' : 
                                         freq === 'DAILY' ? 'يومياً' : 
                                         freq === 'WEEKLY' ? 'أسبوعياً' : 
                                         freq === 'MONTHLY' ? 'شهرياً' : 'سنوياً'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={saveReminder}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            {reminderDate ? 'حفظ التذكير' : 'إلغاء التذكير'}
                        </button>

                         {/* Add to Calendar Button (in Modal) */}
                         {selectedMemoryId && (
                             <div className="border-t border-white/10 pt-4 mt-2">
                                 <button
                                     onClick={(e) => {
                                        e.stopPropagation();
                                        const mem = memories.find(m => m.id === selectedMemoryId);
                                        if (mem && mem.reminder) {
                                            generateGoogleCalendarLink(mem);
                                        } else {
                                            alert("يرجى حفظ التذكير أولاً قبل الإضافة للتقويم");
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 text-xs text-blue-400 hover:underline"
                                >
                                    <CalendarDays size={14} />
                                    إضافة إلى تقويم الهاتف (Google Calendar)
                                </button>
                             </div>
                         )}
                    </div>
                </div>
            </div>
        )}

        {/* --- PRINT TEMPLATE (Visible only on print) --- */}
        {printableMemories && (
            <div id="print-container" className="hidden print:block fixed inset-0 bg-white z-[9999] overflow-visible">
                {/* Print Header */}
                <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-black mb-1">تقرير الذكريات</h1>
                        <p className="text-sm text-gray-600">تم الاستخراج بتاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl font-bold text-black">Thakira AI</h2>
                        <p className="text-xs text-gray-500">الذاكرة الذكية</p>
                    </div>
                </div>

                {/* Print Items */}
                <div className="space-y-6">
                    {printableMemories.map((item) => (
                        <div key={item.id} className="page-break border border-gray-300 rounded-lg p-6 flex gap-6 items-start">
                             {/* Thumbnail Column */}
                             {(item.type === MediaType.IMAGE || item.type === MediaType.VIDEO) && (
                                <div className="w-32 h-32 shrink-0 border border-gray-200 rounded overflow-hidden bg-gray-50">
                                    <img 
                                        src={item.content} 
                                        alt="Thumbnail" 
                                        className="w-full h-full object-cover" 
                                    />
                                </div>
                             )}

                             {/* Content Column */}
                             <div className="flex-1">
                                 <div className="flex justify-between items-start mb-2">
                                     <div className="flex items-center gap-2">
                                         <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700">
                                            {item.type === MediaType.AUDIO ? 'صوت' : item.type === MediaType.VIDEO ? 'فيديو' : item.type === MediaType.IMAGE ? 'صورة' : 'نص'}
                                         </span>
                                         <span className="text-xs text-gray-500">
                                             {new Date(item.createdAt).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 
                                             {' '}- {new Date(item.createdAt).toLocaleTimeString('ar-SA')}
                                         </span>
                                     </div>
                                 </div>

                                 <h3 className="text-lg font-bold text-black mb-2 leading-snug">
                                     {item.summary || "بدون عنوان"}
                                 </h3>

                                 <div className="text-sm text-gray-800 leading-loose whitespace-pre-wrap font-serif mb-3">
                                     {item.transcription || (item.type === MediaType.TEXT ? item.content : "لا يوجد نص")}
                                 </div>

                                 {item.tags && item.tags.length > 0 && (
                                     <div className="flex flex-wrap gap-2 mt-2">
                                         {item.tags.map((tag, idx) => (
                                             <span key={idx} className="text-xs text-gray-600">#{tag}</span>
                                         ))}
                                     </div>
                                 )}
                             </div>
                        </div>
                    ))}
                </div>

                {/* Print Footer */}
                <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                    تم إنشاء هذا التقرير بواسطة تطبيق الذاكرة الذكية
                </div>
            </div>
        )}

        {/* Export Progress Modal */}
        {isExporting && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                 <div className="bg-card w-full max-w-xs p-6 rounded-2xl border border-white/10 shadow-2xl text-center space-y-5">
                     <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                         <FileDown size={32} className="animate-bounce" />
                     </div>
                     <div>
                         <h3 className="text-lg font-bold text-white">جاري تحضير الملف</h3>
                         <p className="text-xs text-gray-400 mt-1">يتم الآن معالجة الصور والنصوص...</p>
                     </div>
                     
                     <div className="space-y-2">
                         <div className="flex justify-between text-xs font-medium text-gray-300 px-1">
                             <span>التقدم</span>
                             <span>{exportProgress}%</span>
                         </div>
                         <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                             <div 
                                 className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-100 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                 style={{ width: `${exportProgress}%` }}
                             />
                         </div>
                     </div>
                 </div>
             </div>
        )}
    </div>
  );
};
