import React, { useState } from 'react';
import { Send, Sparkles, Bot } from 'lucide-react';
import { getMemories } from '../services/db';
import { smartSearch } from '../services/geminiService';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setResponse("");

    try {
      const memories = await getMemories();
      // Only grab the last 20 memories for context to save tokens/bandwidth
      const recentMemories = memories.slice(0, 20); 
      
      const result = await smartSearch(query, recentMemories);
      setResponse(result);
    } catch (err) {
      setResponse("عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 pb-24">
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-6 rounded-2xl border border-white/10 text-center mb-6">
            <Sparkles className="mx-auto text-yellow-300 mb-2" size={32} />
            <h2 className="text-xl font-bold text-white mb-2">اسأل ذاكرتك</h2>
            <p className="text-sm text-gray-300">
                يمكنك سؤالي عن أي شيء قمت بتسجيله سابقاً. مثلاً:
                <br />
                "ماذا فعلت يوم الجمعة الماضي؟"
                <br />
                "لخص لي أفكاري حول المشروع"
            </p>
        </div>

        {/* Chat Interface */}
        {response && (
            <div className="flex gap-3 items-start animate-in slide-in-from-bottom-2">
                <div className="bg-secondary p-2 rounded-full mt-1 shrink-0">
                    <Bot size={20} className="text-white" />
                </div>
                <div className="bg-card border border-white/10 p-4 rounded-2xl rounded-tr-none text-gray-200 leading-relaxed shadow-lg">
                    {response}
                </div>
            </div>
        )}
      </div>

      <form onSubmit={handleSearch} className="relative mt-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في ذكرياتك..."
          className="w-full bg-card border border-white/10 rounded-full py-4 px-6 pl-14 text-right focus:outline-none focus:border-secondary shadow-lg"
          disabled={isSearching}
        />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute left-2 top-2 bottom-2 bg-secondary text-white p-2 rounded-full w-10 h-10 flex items-center justify-center hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          {isSearching ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
};
