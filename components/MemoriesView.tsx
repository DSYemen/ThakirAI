import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPagedMemories, deleteMemory, saveMemory, FilterOptions, getMemories } from '../services/db';
import { MemoryItem, MediaType, ReminderFrequency, Reminder } from '../types';
import { Play, FileText, Image, Trash2, Video, Pause, Search, Filter, MoreVertical, FileJson, FileSpreadsheet, X, Clock, ChevronLeft, Star, Bell, Calendar, ChevronDown, ChevronUp, ArrowUpDown, Loader2 } from 'lucide-react';

interface DisplayMemory extends MemoryItem {
    matchScore?: number;
}

interface MemoryCardProps {
    memory: DisplayMemory;
    isPlaying: boolean;
    onTogglePlay: (id: string) => void;
    onToggleFavorite: (e: React.MouseEvent, id: string) => void;
    onDelete: (id: string) => void;
    onSetReminder: (e: React.MouseEvent, memory: MemoryItem) => void;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ 
    memory, isPlaying, onTogglePlay, onToggleFavorite, onDelete, onSetReminder 
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

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

    return (
        <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`group bg-card/50 backdrop-blur border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-md hover:shadow-lg hover:border-white/10 ${isExpanded ? 'ring-1 ring-primary/30 bg-card/80' : ''}`}
        >
            {/* Header Section */}
            <div className="p-4 pb-2 flex justify-between items-start">
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
                                <div className="flex items-center gap-1 bg-secondary/20 text-secondary text-[9px] px-1.5 py-0.5 rounded-md animate-pulse">
                                    <Bell size={9} fill="currentColor" />
                                </div>
                            )}
                         </div>
                         <span className="text-[10px] text-gray-500 mt-0.5 font-medium flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(memory.createdAt).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' })}
                         </span>
                     </div>
                 </div>

                 {/* Match Score Badge (Search Mode) */}
                 {memory.matchScore !== undefined && (
                    <div className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                        {memory.matchScore}%
                    </div>
                 )}
            </div>

            {/* Summary Section */}
            <div className="px-4 py-1">
                <h3 className={`font-bold text-gray-200 leading-relaxed transition-all ${isExpanded ? 'text-lg mb-2' : 'text-sm line-clamp-1'}`}>
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
                <div className="px-4 py-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    {/* Media Viewer */}
                    <div className="rounded-xl overflow-hidden bg-black/30 border border-white/5">
                        {memory.type === MediaType.IMAGE && (
                            <img src={memory.content} alt="Memory" className="w-full h-auto max-h-[400px] object-contain" />
                        )}
                        {memory.type === MediaType.VIDEO && (
                            <video src={memory.content} controls className="w-full max-h-[400px]" />
                        )}
                        {memory.type === MediaType.AUDIO && (
                            <div className="p-4 flex items-center gap-4">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onTogglePlay(memory.id); }}
                                    className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform shrink-0"
                                >
                                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                                </button>
                                <div className="flex-1 space-y-2">
                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full bg-primary/70 rounded-full transition-all duration-500 ${isPlaying ? 'w-full opacity-100' : 'w-0 opacity-50'}`}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>{isPlaying ? 'جاري التشغيل...' : 'اضغط للاستماع'}</span>
                                        <span className="font-mono">AUDIO</span>
                                    </div>
                                </div>
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
                </div>
            )}

            {/* Footer: Tags & Actions */}
            <div className="px-4 py-3 mt-2 border-t border-white/5 flex flex-col gap-3">
                {/* Tags */}
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
                            onClick={(e) => onToggleFavorite(e, memory.id)}
                            className={`p-2 rounded-full transition-all ${memory.isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-white/5'}`}
                            title="المفضلة"
                        >
                            <Star size={18} fill={memory.isFavorite ? "currentColor" : "none"} />
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
            
            {/* Hidden Audio Player Logic */}
            {memory.type === MediaType.AUDIO && (
                <audio id={`audio-${memory.id}`} src={memory.content} onEnded={() => {
                    onTogglePlay(memory.id); 
                }} className="hidden" />
            )}
        </div>
    );
};

export const MemoriesView: React.FC = () => {
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
  const [sortBy, setSortBy] = useState<'DATE' | 'FAVORITES'>('DATE');
  const [searchQuery, setSearchQuery] = useState("");
  
  // UI State
  const [showMenu, setShowMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Reminder Modal State
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderFreq, setReminderFreq] = useState<ReminderFrequency>('ONCE');

  // Infinite Scroll Ref
  const observerTarget = useRef(null);

  // Reset and Load on Filters Change
  useEffect(() => {
      setMemories([]);
      setCursor(null);
      setHasMore(true);
      loadMemories(true);
  }, [filterType, timeFilter, showFavoritesOnly, sortBy, searchQuery]);

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

  const loadMemories = async (reset: boolean) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
        const filters: FilterOptions = {
            type: filterType,
            timeFilter,
            showFavoritesOnly,
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
            setMemories(prev => [...prev, ...newItems]);
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
    csvContent += "ID,Date,Type,IsFavorite,Summary,Tags,Transcription\n";
    allMemories.forEach(m => {
        const date = new Date(m.createdAt).toLocaleDateString('ar-SA');
        const tags = m.tags ? m.tags.join(";") : "";
        const cleanSummary = (m.summary || "").replace(/,/g, "،").replace(/\n/g, " ");
        const cleanTrans = (m.transcription || "").replace(/,/g, "،").replace(/\n/g, " ");
        const fav = m.isFavorite ? "Yes" : "No";
        csvContent += `"${m.id}","${date}","${m.type}","${fav}","${cleanSummary}","${tags}","${cleanTrans}"\n`;
    });
    downloadFile(csvContent, `thakira_report_${Date.now()}.csv`, 'text/csv');
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: MediaType | 'ALL', label: string, icon: any }) => (
      <button 
        onClick={() => setFilterType(type)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
            filterType === type 
            ? 'bg-white text-dark shadow-lg scale-105' 
            : 'bg-white/5 text-gray-400 hover:bg-white/10'
        }`}
      >
          <Icon size={14} />
          {label}
      </button>
  );

  const TimeFilterButton = ({ type, label }: { type: typeof timeFilter, label: string }) => (
      <button 
        onClick={() => setTimeFilter(type)}
        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap border ${
            timeFilter === type 
            ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
            : 'bg-transparent border-white/5 text-gray-400 hover:bg-white/5'
        }`}
      >
          {label}
      </button>
  );

  return (
    <div className="flex flex-col h-full bg-dark relative" onClick={() => showMenu && setShowMenu(false)}>
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

                  <div className="h-px bg-white/10 my-2" />
                  <div className="text-xs text-gray-500 font-bold px-3 py-2">تصدير</div>
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
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button 
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
                        showFavoritesOnly 
                        ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                        : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                    }`}
                >
                    <Star size={14} fill={showFavoritesOnly ? "currentColor" : "none"} />
                    المفضلة فقط
                </button>
                <div className="w-px h-6 bg-white/10 mx-1 self-center" />
                <FilterButton type="ALL" label="الكل" icon={Filter} />
                <FilterButton type={MediaType.AUDIO} label="صوتيات" icon={Play} />
                <FilterButton type={MediaType.VIDEO} label="فيديو" icon={Video} />
                <FilterButton type={MediaType.IMAGE} label="صور" icon={Image} />
                <FilterButton type={MediaType.TEXT} label="نصوص" icon={FileText} />
             </div>

             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-white/5 mt-2">
                    <div className="flex items-center gap-1 text-gray-500 pl-2 border-l border-white/10 ml-1 shrink-0">
                        <Clock size={14} />
                        <span className="text-[10px]">التاريخ</span>
                    </div>
                    <TimeFilterButton type="ALL" label="كل الأوقات" />
                    <TimeFilterButton type="TODAY" label="اليوم" />
                    <TimeFilterButton type="WEEK" label="أسبوع" />
                    <TimeFilterButton type="MONTH" label="شهر" />
                    <TimeFilterButton type="YEAR" label="سنة" />
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
                {(filterType !== 'ALL' || timeFilter !== 'ALL' || searchQuery || showFavoritesOnly) && (
                    <button 
                        onClick={() => { setFilterType('ALL'); setTimeFilter('ALL'); setSearchQuery(''); setIsSearchOpen(false); setShowFavoritesOnly(false); }}
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
                        memory={mem}
                        isPlaying={playingId === mem.id}
                        onTogglePlay={togglePlay}
                        onToggleFavorite={handleToggleFavorite}
                        onDelete={handleDelete}
                        onSetReminder={openReminderModal}
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
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};