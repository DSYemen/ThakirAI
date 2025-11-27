
import React, { useState, useEffect } from 'react';
import { getAllReminders, saveMemory } from '../services/db';
import { MemoryItem, MediaType, TaskCategory } from '../types';
import { Calendar, Clock, CheckCircle2, Circle, AlertCircle, X, Check, Layers, Tag, Briefcase, Heart, User, DollarSign, PartyPopper, Hash } from 'lucide-react';

interface TaskGroup {
    overdue: MemoryItem[];
    today: MemoryItem[];
    tomorrow: MemoryItem[];
    upcoming: MemoryItem[];
    completed: MemoryItem[];
}

interface TaskCardProps {
    item: MemoryItem;
    isOverdue?: boolean;
    onComplete: (task: MemoryItem) => void;
    onEditCategory: (task: MemoryItem) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string, border: string, text: string, iconBg: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/5', border: 'border-blue-200 dark:border-blue-500/20', text: 'text-blue-700 dark:text-blue-300', iconBg: 'bg-blue-100 dark:bg-blue-500/20' },
    red: { bg: 'bg-red-50 dark:bg-red-500/5', border: 'border-red-200 dark:border-red-500/20', text: 'text-red-700 dark:text-red-300', iconBg: 'bg-red-100 dark:bg-red-500/20' },
    green: { bg: 'bg-green-50 dark:bg-green-500/5', border: 'border-green-200 dark:border-green-500/20', text: 'text-green-700 dark:text-green-300', iconBg: 'bg-green-100 dark:bg-green-500/20' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-500/5', border: 'border-yellow-200 dark:border-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', iconBg: 'bg-yellow-100 dark:bg-yellow-500/20' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/5', border: 'border-purple-200 dark:border-purple-500/20', text: 'text-purple-700 dark:text-purple-300', iconBg: 'bg-purple-100 dark:bg-purple-500/20' },
    gray: { bg: 'bg-gray-50 dark:bg-white/5', border: 'border-gray-100 dark:border-white/10', text: 'text-gray-700 dark:text-gray-300', iconBg: 'bg-gray-200 dark:bg-white/10' },
};

const TaskCard: React.FC<TaskCardProps> = ({ item, isOverdue = false, onComplete, onEditCategory }) => {
    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    };

    const formatFullDate = (ts: number) => {
        return new Date(ts).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    // Determine Styles
    const catColor = item.category?.colorName || 'gray';
    const styles = isOverdue ? CATEGORY_STYLES['red'] : CATEGORY_STYLES[catColor];

    // Determine Icon
    const renderIcon = () => {
        const size = 16;
        switch(item.category?.iconName) {
            case 'briefcase': return <Briefcase size={size} />;
            case 'heart': return <Heart size={size} />;
            case 'user': return <User size={size} />;
            case 'dollar': return <DollarSign size={size} />;
            case 'party': return <PartyPopper size={size} />;
            default: return <Hash size={size} />;
        }
    };

    return (
        <div className={`relative group flex items-start gap-3 p-4 rounded-2xl border transition-all shadow-sm ${styles.bg} ${styles.border}`}>
            <button 
                onClick={() => onComplete(item)}
                className={`mt-1 flex-shrink-0 transition-colors ${isOverdue ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-green-500'}`}
            >
                <Circle size={22} strokeWidth={2} />
            </button>
            
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h4 className={`text-base font-bold leading-tight ${styles.text}`}>
                        {item.summary || "تذكير بدون عنوان"}
                    </h4>
                    
                    {/* Category Icon Badge */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEditCategory(item); }}
                        className={`flex-shrink-0 ml-1 w-7 h-7 rounded-full flex items-center justify-center ${styles.iconBg} ${styles.text} opacity-80 hover:opacity-100 transition-opacity`}
                    >
                        {renderIcon()}
                    </button>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs font-mono font-bold flex items-center gap-1.5 px-2 py-1 rounded-md ${isOverdue ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300' : 'bg-white/50 dark:bg-black/20 text-gray-600 dark:text-gray-300'}`}>
                        <Clock size={12} />
                        {formatTime(item.reminder!.timestamp)}
                    </span>
                    {!isOverdue && (
                         <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium px-1 opacity-80">
                            {formatFullDate(item.reminder!.timestamp)}
                         </span>
                    )}
                    {item.reminder?.frequency !== 'ONCE' && (
                        <span className="text-[10px] font-bold bg-white/50 dark:bg-black/20 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
                            {item.reminder?.frequency === 'DAILY' ? 'يومياً' : item.reminder?.frequency === 'WEEKLY' ? 'أسبوعياً' : item.reminder?.frequency}
                        </span>
                    )}
                </div>
                {item.transcription && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed opacity-90">{item.transcription}</p>
                )}
            </div>
        </div>
    );
};

type FilterType = 'ALL' | 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'UPCOMING' | 'COMPLETED';

const PRESET_CATEGORIES: TaskCategory[] = [
    { id: 'work', label: 'عمل', colorName: 'blue', iconName: 'briefcase' },
    { id: 'health', label: 'صحة', colorName: 'red', iconName: 'heart' },
    { id: 'personal', label: 'شخصي', colorName: 'green', iconName: 'user' },
    { id: 'finance', label: 'مالية', colorName: 'yellow', iconName: 'dollar' },
    { id: 'event', label: 'مناسبة', colorName: 'purple', iconName: 'party' },
    { id: 'general', label: 'عام', colorName: 'gray', iconName: 'default' },
];

export const ScheduleView: React.FC = () => {
  const [tasks, setTasks] = useState<TaskGroup>({ overdue: [], today: [], tomorrow: [], upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  
  // Completion Modal
  const [selectedTask, setSelectedTask] = useState<MemoryItem | null>(null);
  const [note, setNote] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Category Modal
  const [taskToCategorize, setTaskToCategorize] = useState<MemoryItem | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
        const all = await getAllReminders();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const tomorrowStart = todayStart + (24 * 60 * 60 * 1000);
        const afterTomorrowStart = tomorrowStart + (24 * 60 * 60 * 1000);

        const groups: TaskGroup = { overdue: [], today: [], tomorrow: [], upcoming: [], completed: [] };

        all.forEach(item => {
            if (item.isCompleted) { groups.completed.push(item); return; }
            if (!item.reminder) return;
            const t = item.reminder.timestamp;
            if (t < now.getTime()) { if (t < todayStart) groups.overdue.push(item); else groups.today.push(item); }
            else if (t >= todayStart && t < tomorrowStart) groups.today.push(item);
            else if (t >= tomorrowStart && t < afterTomorrowStart) groups.tomorrow.push(item);
            else groups.upcoming.push(item);
        });
        groups.completed.reverse(); 
        setTasks(groups);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const initiateComplete = (task: MemoryItem) => { setSelectedTask(task); setNote(""); setShowCompleteModal(true); };
  const initiateCategorize = (task: MemoryItem) => { setTaskToCategorize(task); setShowCategoryModal(true); };

  const confirmComplete = async () => {
    if (!selectedTask) return;
    const originalTask = selectedTask;
    const isRecurring = originalTask.reminder && originalTask.reminder.frequency !== 'ONCE';

    if (isRecurring && originalTask.reminder) {
        const now = Date.now();
        let nextTimestamp = originalTask.reminder.timestamp;
        const freq = originalTask.reminder.frequency;
        while (nextTimestamp <= now) {
            const d = new Date(nextTimestamp);
            if (freq === 'DAILY') d.setDate(d.getDate() + 1);
            else if (freq === 'WEEKLY') d.setDate(d.getDate() + 7);
            else if (freq === 'MONTHLY') d.setMonth(d.getMonth() + 1);
            else if (freq === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
            nextTimestamp = d.getTime();
        }
        await saveMemory({ ...originalTask, reminder: { ...originalTask.reminder, timestamp: nextTimestamp } });
        if (note.trim()) {
            await saveMemory({ id: crypto.randomUUID(), type: MediaType.TEXT, content: note, summary: `تم إنجاز: ${originalTask.summary}`, createdAt: Date.now(), tags: ['إنجاز', 'سجل_مواعيد'], isCompleted: true, completionNote: note });
        }
    } else {
        await saveMemory({ ...originalTask, isCompleted: true, completionNote: note || undefined });
    }
    setShowCompleteModal(false); loadTasks();
  };

  const applyCategory = async (category: TaskCategory) => {
      if (!taskToCategorize) return;
      const updated = { ...taskToCategorize, category };
      await saveMemory(updated);
      setShowCategoryModal(false);
      loadTasks();
  };

  const FilterBadge = ({ type, label, count, colorClass, activeClass }: { type: FilterType, label: string, count: number, colorClass: string, activeClass: string }) => (
      <button 
        onClick={() => setActiveFilter(type)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all whitespace-nowrap ${
            activeFilter === type 
            ? `${activeClass} shadow-md scale-105` 
            : 'bg-white dark:bg-card border-gray-100 dark:border-white/5 text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'
        }`}
      >
        <span className="text-xs font-bold">{label}</span>
        {count > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${activeFilter === type ? 'bg-white/20' : colorClass}`}>
                {count}
            </span>
        )}
      </button>
  );

  // Total pending tasks
  const pendingCount = tasks.overdue.length + tasks.today.length + tasks.tomorrow.length + tasks.upcoming.length;

  return (
    <div className="flex flex-col h-full bg-dark relative">
      {/* Unified Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 pt-4 px-4 pb-2 shadow-sm space-y-3">
           <div className="flex justify-between items-center h-10">
                <div>
                    <h2 className="text-xl font-bold text-foreground">مواعيدي</h2>
                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Calendar size={20} />
                </div>
           </div>

           {/* Filter Bar */}
           <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
                <FilterBadge type="ALL" label="الكل" count={pendingCount} colorClass="bg-gray-100 text-gray-600" activeClass="bg-gray-800 text-white dark:bg-white dark:text-slate-900" />
                <FilterBadge type="OVERDUE" label="فائتة" count={tasks.overdue.length} colorClass="bg-red-100 text-red-600" activeClass="bg-red-500 text-white border-red-600" />
                <FilterBadge type="TODAY" label="اليوم" count={tasks.today.length} colorClass="bg-primary/10 text-primary" activeClass="bg-primary text-white border-primary" />
                <FilterBadge type="TOMORROW" label="غداً" count={tasks.tomorrow.length} colorClass="bg-blue-100 text-blue-600" activeClass="bg-blue-500 text-white border-blue-600" />
                <FilterBadge type="UPCOMING" label="قادمة" count={tasks.upcoming.length} colorClass="bg-orange-100 text-orange-600" activeClass="bg-orange-500 text-white border-orange-600" />
                <FilterBadge type="COMPLETED" label="منجزة" count={tasks.completed.length} colorClass="bg-green-100 text-green-600" activeClass="bg-green-500 text-white border-green-600" />
           </div>
      </div>

      <div className="p-4 pb-24 space-y-6 overflow-y-auto flex-1">
        {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                 <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
        ) : (
            <>
                {/* Empty State Logic */}
                {activeFilter !== 'ALL' && 
                 ((activeFilter === 'OVERDUE' && tasks.overdue.length === 0) ||
                  (activeFilter === 'TODAY' && tasks.today.length === 0) ||
                  (activeFilter === 'TOMORROW' && tasks.tomorrow.length === 0) ||
                  (activeFilter === 'UPCOMING' && tasks.upcoming.length === 0) ||
                  (activeFilter === 'COMPLETED' && tasks.completed.length === 0)) && (
                    <div className="flex flex-col items-center justify-center py-10 opacity-50 animate-in fade-in">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400">
                            <Layers size={32} />
                        </div>
                        <p className="text-sm">لا توجد عناصر في هذه القائمة</p>
                    </div>
                )}
                
                {/* Default Empty State */}
                {activeFilter === 'ALL' && pendingCount === 0 && tasks.completed.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 text-gray-400">
                            <Check size={32} />
                        </div>
                        <p className="text-sm">جدولك فارغ تماماً!</p>
                    </div>
                )}

                {/* Overdue Section */}
                {(activeFilter === 'ALL' || activeFilter === 'OVERDUE') && tasks.overdue.length > 0 && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                        <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-2 px-1"><AlertCircle size={14} /> مهام فائتة</h3>
                        {tasks.overdue.map(item => <TaskCard key={item.id} item={item} isOverdue onComplete={initiateComplete} onEditCategory={initiateCategorize} />)}
                    </div>
                )}

                {/* Today Section */}
                {(activeFilter === 'ALL' || activeFilter === 'TODAY') && tasks.today.length > 0 && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300 delay-75">
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider px-1">اليوم</h3>
                        {tasks.today.map(item => <TaskCard key={item.id} item={item} onComplete={initiateComplete} onEditCategory={initiateCategorize} />)}
                    </div>
                )}

                {/* Tomorrow Section */}
                {(activeFilter === 'ALL' || activeFilter === 'TOMORROW') && tasks.tomorrow.length > 0 && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300 delay-100">
                        <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">غداً</h3>
                        {tasks.tomorrow.map(item => <TaskCard key={item.id} item={item} onComplete={initiateComplete} onEditCategory={initiateCategorize} />)}
                    </div>
                )}

                {/* Upcoming Section */}
                {(activeFilter === 'ALL' || activeFilter === 'UPCOMING') && tasks.upcoming.length > 0 && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300 delay-150">
                        <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider px-1">قادمة</h3>
                        {tasks.upcoming.map(item => <TaskCard key={item.id} item={item} onComplete={initiateComplete} onEditCategory={initiateCategorize} />)}
                    </div>
                )}

                {/* Completed Section */}
                {(activeFilter === 'ALL' || activeFilter === 'COMPLETED') && tasks.completed.length > 0 && (
                    <div className={`space-y-3 animate-in slide-in-from-bottom-2 duration-300 ${activeFilter === 'ALL' ? 'pt-6 border-t border-gray-100 dark:border-white/5' : ''}`}>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">المهام المنجزة ({tasks.completed.length})</h3>
                        <div className={`${activeFilter === 'ALL' ? 'opacity-70' : 'opacity-100'} space-y-2`}>
                            {tasks.completed.slice(0, activeFilter === 'ALL' ? 5 : undefined).map(item => (
                                <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-transparent dark:border-white/5">
                                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="text-xs font-bold text-gray-500 line-through decoration-gray-400">{item.summary}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-gray-400 font-mono">{new Date(item.reminder?.timestamp || item.createdAt).toLocaleDateString('ar-SA')}</span>
                                            {item.completionNote && <p className="text-[10px] text-green-600 dark:text-green-400">ملاحظة: {item.completionNote}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {activeFilter === 'ALL' && tasks.completed.length > 5 && (
                                <button onClick={() => setActiveFilter('COMPLETED')} className="w-full py-2 text-xs text-center text-gray-400 hover:text-primary transition-colors">عرض كل المنجزات</button>
                            )}
                        </div>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Complete Task Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-card w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden p-5">
                <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check size={24} className="text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">إتمام المهمة</h3>
                    <p className="text-sm text-gray-500 line-clamp-1">{selectedTask?.summary}</p>
                </div>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="إضافة ملاحظة إنجاز (اختياري)..." className="w-full h-24 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-green-500 resize-none mb-4 text-foreground" />
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowCompleteModal(false)} className="py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold text-sm">إلغاء</button>
                    <button onClick={confirmComplete} className="py-3 rounded-xl bg-green-500 text-white font-bold text-sm shadow-lg shadow-green-500/20">تأكيد</button>
                </div>
            </div>
        </div>
      )}

      {/* Category Selection Modal */}
      {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-card w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl border-t sm:border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden p-6 animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Tag size={20} className="text-primary" />
                            تصنيف المهمة
                        </h3>
                        <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-foreground"><X size={20} /></button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {PRESET_CATEGORIES.map(cat => {
                            const style = CATEGORY_STYLES[cat.colorName];
                            return (
                                <button 
                                    key={cat.id} 
                                    onClick={() => applyCategory(cat)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-105 active:scale-95 ${style.bg} ${style.border}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.iconBg} ${style.text}`}>
                                        {cat.iconName === 'briefcase' && <Briefcase size={16} />}
                                        {cat.iconName === 'heart' && <Heart size={16} />}
                                        {cat.iconName === 'user' && <User size={16} />}
                                        {cat.iconName === 'dollar' && <DollarSign size={16} />}
                                        {cat.iconName === 'party' && <PartyPopper size={16} />}
                                        {cat.iconName === 'default' && <Hash size={16} />}
                                    </div>
                                    <span className={`text-sm font-bold ${style.text}`}>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
              </div>
          </div>
      )}
    </div>
  );
};
