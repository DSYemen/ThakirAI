
import React, { useState, useEffect, useMemo } from 'react';
import { Moon, Sun, Key, Save, Database, Upload, Download, Smartphone, Check, AlertCircle, Loader2, RefreshCw, FolderOpen, ToggleLeft, ToggleRight, Settings, Globe, Languages, Calendar, ChevronLeft, Search, X } from 'lucide-react';
import { AppSettings } from '../types';
import { getSettings, saveSettings } from '../services/settingsService';
import { exportDatabase, importDatabase } from '../services/db';
import { saveMediaToDownloads, downloadBackupFile } from '../services/storageService';

interface SelectionModalProps {
    title: string;
    options: { value: string; label: string }[];
    selectedValue: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}

const SelectionModal: React.FC<SelectionModalProps> = ({ title, options, selectedValue, onSelect, onClose }) => {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        const q = searchQuery.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q));
    }, [options, searchQuery]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-10 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-foreground">
                    <X size={24} />
                </button>
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                <div className="w-10" /> {/* Spacer for centering */}
            </div>

            {/* Search */}
            <div className="p-4 bg-gray-50 dark:bg-black/20">
                <div className="relative">
                    <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="بحث..." 
                        autoFocus
                        className="w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm text-foreground focus:outline-none focus:border-primary" 
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredOptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <p className="text-sm">لا توجد نتائج</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredOptions.map((opt) => {
                            const isSelected = opt.value === selectedValue;
                            return (
                                <button 
                                    key={opt.value} 
                                    onClick={() => onSelect(opt.value)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isSelected ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'}`}
                                >
                                    <span className="text-sm text-right" dir="auto">{opt.label}</span>
                                    {isSelected && <Check size={18} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [availableTimeZones, setAvailableTimeZones] = useState<string[]>([]);
  
  // Selection Modal State
  const [activeModal, setActiveModal] = useState<'TIMEZONE' | 'LANGUAGE' | null>(null);

  const languages = [
      { code: 'ar-SA', name: 'العربية (Arabic)' },
      { code: 'en-US', name: 'English (United States)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'fr-FR', name: 'Français' },
      { code: 'es-ES', name: 'Español' },
      { code: 'de-DE', name: 'Deutsch' },
      { code: 'tr-TR', name: 'Türkçe' },
      { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
      { code: 'zh-CN', name: '中文 (Chinese)' }
  ];

  useEffect(() => { 
      setSettings(getSettings());
      try {
        // Get list of supported timezones
        const zones = (Intl as any).supportedValuesOf('timeZone');
        setAvailableTimeZones(zones);
      } catch (e) {
        setAvailableTimeZones(['UTC', 'Asia/Riyadh', 'Africa/Cairo', 'Asia/Dubai', 'Europe/London', 'America/New_York']);
      }
  }, []);

  const handleSaveSettings = () => {
    if (!settings.customMediaFolder?.trim()) settings.customMediaFolder = 'Thakira_Media';
    saveSettings(settings); showStatus('success', 'تم حفظ الإعدادات بنجاح.');
    // Force reload to apply language changes globally if needed, or rely on state updates
    if (settings.language !== getSettings().language) {
        window.location.reload();
    }
  };

  const showStatus = (type: 'success' | 'error', text: string) => { setStatusMsg({ type, text }); setTimeout(() => setStatusMsg(null), 4000); };
  
  const toggleTheme = () => { 
    const newTheme: 'dark' | 'light' = settings.theme === 'dark' ? 'light' : 'dark'; 
    const newSettings: AppSettings = { ...settings, theme: newTheme }; 
    setSettings(newSettings); 
    saveSettings(newSettings); 
  };

  const handleExportDB = async () => { setIsProcessing(true); try { const json = await exportDatabase(); downloadBackupFile(json); showStatus('success', 'تم النسخ الاحتياطي.'); } catch (e) { showStatus('error', 'فشل النسخ.'); } finally { setIsProcessing(false); } };
  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !confirm("تحذير: سيتم استبدال البيانات الحالية. متابعة؟")) return;
    setIsProcessing(true); const reader = new FileReader();
    reader.onload = async (ev) => { try { if (await importDatabase(ev.target?.result as string)) showStatus('success', 'تمت الاستعادة.'); else showStatus('error', 'ملف غير صالح.'); } catch (err) { showStatus('error', 'خطأ.'); } finally { setIsProcessing(false); } };
    reader.readAsText(file);
  };
  const handleExportMedia = async () => { if (!confirm("سيتم التصدير لمجلد المستندات. متابعة؟")) return; setIsProcessing(true); setProgress(0); try { const msg = await saveMediaToDownloads((c, t) => setProgress(Math.round((c / t) * 100))); showStatus('success', msg); } catch (e: any) { showStatus('error', e.message); } finally { setIsProcessing(false); setProgress(0); } };

  return (
    <div className="flex flex-col h-full bg-dark overflow-y-auto pb-24 relative">
      {/* Unified Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 p-4 shadow-sm">
           <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-foreground">الإعدادات</h2>
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                    <Settings size={20} />
                </div>
           </div>
      </div>

      <div className="p-4 space-y-6">
        {statusMsg && (
            <div className={`p-4 rounded-xl flex items-center gap-3 border ${statusMsg.type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {statusMsg.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{statusMsg.text}</p>
            </div>
        )}

        {/* Section 1: Appearance */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">المظهر</h3>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-2 flex shadow-sm">
                <button onClick={() => settings.theme !== 'light' && toggleTheme()} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${settings.theme === 'light' ? 'bg-primary text-white shadow-md' : 'text-gray-400'}`}><Sun size={18} /> فاتح</button>
                <button onClick={() => settings.theme !== 'dark' && toggleTheme()} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${settings.theme === 'dark' ? 'bg-slate-900 text-white shadow-md' : 'text-gray-400'}`}><Moon size={18} /> داكن</button>
            </div>
        </div>

        {/* Section 2: Time & Region */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">المنطقة واللغة</h3>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
                
                {/* Timezone */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-500 flex items-center gap-1"><Globe size={12}/> المنطقة الزمنية</label>
                    <button 
                        onClick={() => setActiveModal('TIMEZONE')}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl p-3 flex justify-between items-center transition-colors hover:border-secondary"
                    >
                        <span className="text-sm text-foreground">{settings.timeZone?.replace(/_/g, ' ') || 'اختر المنطقة...'}</span>
                        <ChevronLeft size={16} className="text-gray-400" />
                    </button>
                </div>

                {/* Language */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-500 flex items-center gap-1"><Languages size={12}/> لغة التطبيق والبحث</label>
                    <button 
                        onClick={() => setActiveModal('LANGUAGE')}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl p-3 flex justify-between items-center transition-colors hover:border-secondary"
                    >
                        <span className="text-sm text-foreground">{languages.find(l => l.code === settings.language)?.name || settings.language}</span>
                        <ChevronLeft size={16} className="text-gray-400" />
                    </button>
                    <p className="text-[10px] text-gray-400">تستخدم للبحث الصوتي وتحليل الذكاء الاصطناعي.</p>
                </div>
                
                <button onClick={handleSaveSettings} className="w-full bg-secondary/10 text-secondary border border-secondary/20 py-3 rounded-xl font-bold text-sm flex justify-center gap-2"><Save size={16} /> حفظ التغييرات</button>

            </div>
        </div>

        {/* Section 3: Integrations (Calendar, etc) */}
        <div className="space-y-3">
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">التكامل</h3>
             <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                             <Calendar size={14} className="text-blue-500" /> مزامنة تقويم جوجل
                        </h4>
                        <p className="text-[10px] text-gray-500">تفعيل خيار "إضافة لتقويم جوجل" تلقائياً</p>
                    </div>
                    <button onClick={() => setSettings({...settings, syncNewTasksToCalendar: !settings.syncNewTasksToCalendar})} className={`${settings.syncNewTasksToCalendar ? 'text-blue-500' : 'text-gray-300'}`}>
                        {settings.syncNewTasksToCalendar ? <ToggleRight size={40} className="opacity-100" /> : <ToggleLeft size={40} />}
                    </button>
                </div>
                <button onClick={handleSaveSettings} className="w-full bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20 py-3 rounded-xl font-bold text-sm flex justify-center gap-2"><Save size={16} /> حفظ التغييرات</button>
             </div>
        </div>

        {/* Section 4: Storage */}
        <div className="space-y-3">
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">التخزين</h3>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div><h4 className="text-sm font-bold text-foreground">الحفظ التلقائي للوسائط</h4><p className="text-[10px] text-gray-500">حفظ في المستندات فوراً</p></div>
                    <button onClick={() => setSettings({...settings, autoSaveMedia: !settings.autoSaveMedia})} className={`${settings.autoSaveMedia ? 'text-green-500' : 'text-gray-300'}`}>{settings.autoSaveMedia ? <ToggleRight size={40} className="opacity-100" /> : <ToggleLeft size={40} />}</button>
                </div>
                {settings.autoSaveMedia && (
                    <div className="space-y-2">
                        <label className="text-xs text-gray-500">اسم المجلد</label>
                        <input type="text" value={settings.customMediaFolder || ''} onChange={(e) => setSettings({...settings, customMediaFolder: e.target.value})} className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-foreground focus:border-green-500 ltr" dir="ltr" />
                    </div>
                )}
                 <button onClick={handleSaveSettings} className="w-full bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20 py-3 rounded-xl font-bold text-sm flex justify-center gap-2"><Save size={16} /> حفظ التغييرات</button>
            </div>
        </div>

        {/* Section 5: AI */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">الذكاء الاصطناعي</h3>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="space-y-2">
                    <label className="text-xs text-gray-500">API Key</label>
                    <input type="password" value={settings.apiKey} onChange={(e) => setSettings({...settings, apiKey: e.target.value})} placeholder="Default" className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-foreground focus:border-secondary" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-gray-500">Model</label>
                    <select value={settings.aiModel} onChange={(e) => setSettings({...settings, aiModel: e.target.value})} className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-foreground focus:border-secondary">
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-pro">Gemini Pro</option>
                    </select>
                </div>
                <button onClick={handleSaveSettings} className="w-full bg-secondary/10 text-secondary border border-secondary/20 py-3 rounded-xl font-bold text-sm flex justify-center gap-2"><Save size={16} /> حفظ التغييرات</button>
            </div>
        </div>

        {/* Section 6: Data */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">البيانات</h3>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
                <button onClick={handleExportMedia} disabled={isProcessing} className="w-full bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-foreground py-3 rounded-xl font-medium text-sm border border-gray-200 dark:border-white/10 flex justify-center gap-2">
                    {isProcessing && progress > 0 ? `${progress}%` : <><Smartphone size={16} /> تصدير الوسائط</>}
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExportDB} disabled={isProcessing} className="py-3 rounded-xl bg-blue-500/10 text-blue-500 font-medium text-sm flex justify-center gap-2">{isProcessing && progress === 0 ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />} نسخ احتياطي</button>
                    <label className="py-3 rounded-xl bg-gray-50 text-gray-500 border border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10 font-medium text-sm flex justify-center gap-2 cursor-pointer">
                        <Upload size={16} /> استعادة <input type="file" accept=".json" onChange={handleImportDB} className="hidden" disabled={isProcessing} />
                    </label>
                </div>
            </div>
        </div>
        <div className="text-center pt-4 pb-2"><p className="text-xs text-gray-400">الإصدار 1.0.4</p></div>
      </div>

      {/* Modals */}
      {activeModal === 'TIMEZONE' && (
          <SelectionModal 
            title="اختر المنطقة الزمنية"
            options={availableTimeZones.map(tz => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
            selectedValue={settings.timeZone || ''}
            onSelect={(val) => { setSettings({ ...settings, timeZone: val }); setActiveModal(null); }}
            onClose={() => setActiveModal(null)}
          />
      )}
      {activeModal === 'LANGUAGE' && (
          <SelectionModal 
            title="اختر لغة التطبيق"
            options={languages.map(l => ({ value: l.code, label: l.name }))}
            selectedValue={settings.language || ''}
            onSelect={(val) => { setSettings({ ...settings, language: val }); setActiveModal(null); }}
            onClose={() => setActiveModal(null)}
          />
      )}
    </div>
  );
};
