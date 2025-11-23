import React, { useEffect, useState } from 'react';
import { getMemories, deleteMemory } from '../services/db';
import { MemoryItem, MediaType } from '../types';
import { Play, FileText, Image, Trash2, Tag, Calendar } from 'lucide-react';

export const MemoriesView: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getMemories();
    setMemories(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الذكرى؟")) {
      await deleteMemory(id);
      loadData();
    }
  };

  const playAudio = (id: string, base64: string) => {
    if (playingAudio === id) {
        // Stop logic would go here if we kept ref to audio element
        setPlayingAudio(null);
        return;
    }
    const audio = new Audio(base64);
    audio.play();
    setPlayingAudio(id);
    audio.onended = () => setPlayingAudio(null);
  };

  if (loading) return <div className="flex justify-center pt-20"><div className="animate-spin text-primary">...</div></div>;

  return (
    <div className="p-4 pb-24 space-y-6">
      <h2 className="text-xl font-bold px-2">شريط الذكريات</h2>
      
      {memories.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
              <p>لا توجد ذكريات محفوظة بعد.</p>
              <p className="text-sm mt-2">ابدأ بتسجيل لحظاتك!</p>
          </div>
      ) : (
          <div className="space-y-4">
            {memories.map((mem) => (
              <div key={mem.id} className="bg-card rounded-2xl overflow-hidden border border-white/5 shadow-lg animate-in slide-in-from-bottom-4 duration-500">
                {/* Header: Date & Type */}
                <div className="flex justify-between items-center p-3 bg-white/5">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar size={12} />
                        {new Date(mem.createdAt).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="bg-dark/50 p-1.5 rounded-full">
                        {mem.type === MediaType.AUDIO && <Play size={14} className="text-blue-400" />}
                        {mem.type === MediaType.IMAGE && <Image size={14} className="text-purple-400" />}
                        {mem.type === MediaType.TEXT && <FileText size={14} className="text-green-400" />}
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-4">
                    {/* Media Display */}
                    {mem.type === MediaType.IMAGE && (
                        <div className="mb-3 rounded-lg overflow-hidden max-h-60">
                            <img src={mem.content} alt="Memory" className="w-full object-cover" />
                        </div>
                    )}
                    
                    {mem.type === MediaType.AUDIO && (
                         <button 
                            onClick={() => playAudio(mem.id, mem.content)}
                            className="w-full flex items-center justify-between bg-primary/10 hover:bg-primary/20 p-3 rounded-xl mb-3 transition-colors border border-primary/20"
                         >
                             <span className="text-sm font-medium text-primary">
                                 {playingAudio === mem.id ? 'جاري التشغيل...' : 'استماع للتسجيل'}
                             </span>
                             <div className={`p-2 rounded-full bg-primary text-white ${playingAudio === mem.id ? 'animate-pulse' : ''}`}>
                                <Play size={16} fill="currentColor" />
                             </div>
                         </button>
                    )}

                    {/* AI Analysis Result */}
                    {mem.summary && (
                        <div className="mb-3">
                            <p className="text-lg font-medium text-white/90 leading-relaxed">
                                {mem.summary}
                            </p>
                        </div>
                    )}
                    
                    {/* Full Text / Transcription (Collapsible usually, but showing inline for now) */}
                    <div className="bg-dark/30 p-3 rounded-lg text-sm text-gray-400 mb-3 border border-white/5">
                        <p className="line-clamp-3">{mem.transcription || mem.content}</p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {mem.tags.map((tag, idx) => (
                            <span key={idx} className="flex items-center gap-1 text-[10px] bg-secondary/10 text-secondary px-2 py-1 rounded-md border border-secondary/20">
                                <Tag size={10} />
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end border-t border-white/5 pt-3">
                        <button 
                            onClick={() => handleDelete(mem.id)}
                            className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
              </div>
            ))}
          </div>
      )}
    </div>
  );
};
