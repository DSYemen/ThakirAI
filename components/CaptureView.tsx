import React, { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Mic, Loader2, Image as ImageIcon, Send } from 'lucide-react';
import { analyzeMedia } from '../services/geminiService';
import { saveMemory } from '../services/db';
import { MediaType, MemoryItem } from '../types';

export const CaptureView: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<string>(""); // "processing", "saving", "idle"
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = handleAudioStop;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("يرجى السماح بالوصول للميكروفون");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleAudioStop = async () => {
    setStatus("processing");
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const base64Audio = await blobToBase64(audioBlob);

    // AI Analysis
    const analysis = await analyzeMedia(MediaType.AUDIO, base64Audio, inputText);

    const memory: MemoryItem = {
      id: crypto.randomUUID(),
      type: MediaType.AUDIO,
      content: base64Audio,
      createdAt: Date.now(),
      transcription: analysis.transcription,
      summary: analysis.summary,
      tags: analysis.tags,
      metadata: { mimeType: 'audio/webm' }
    };

    await saveMemory(memory);
    setStatus("saved");
    setInputText("");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("processing");
    const base64Img = await blobToBase64(file);
    
    const analysis = await analyzeMedia(MediaType.IMAGE, base64Img, inputText);

    const memory: MemoryItem = {
      id: crypto.randomUUID(),
      type: MediaType.IMAGE,
      content: base64Img,
      createdAt: Date.now(),
      transcription: analysis.transcription, // Image description
      summary: analysis.summary,
      tags: analysis.tags,
      metadata: { mimeType: file.type }
    };

    await saveMemory(memory);
    setStatus("saved");
    setInputText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setStatus(""), 2000);
  };

  const handleTextSubmit = async () => {
      if (!inputText.trim()) return;
      setStatus("processing");
      
      const analysis = await analyzeMedia(MediaType.TEXT, "", inputText);
      
       const memory: MemoryItem = {
            id: crypto.randomUUID(),
            type: MediaType.TEXT,
            content: inputText,
            createdAt: Date.now(),
            transcription: inputText,
            summary: analysis.summary,
            tags: analysis.tags,
        };

        await saveMemory(memory);
        setStatus("saved");
        setInputText("");
        setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 animate-in fade-in zoom-in duration-300">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          سجل ذكرياتك
        </h2>
        <p className="text-gray-400 text-sm">
          تحدث، صور، أو اكتب. الذكاء الاصطناعي سيتولى الباقي.
        </p>
      </div>

      {/* Main Action Area */}
      <div className="relative w-full max-w-xs aspect-square flex items-center justify-center">
        {/* Animated Rings when recording */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping"></div>
        )}
        {isRecording && (
            <div className="absolute inset-4 rounded-full border-4 border-secondary/20 animate-pulse"></div>
        )}

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
            isRecording 
              ? 'bg-red-500 shadow-red-500/50 scale-110' 
              : 'bg-gradient-to-br from-primary to-secondary shadow-primary/50 hover:scale-105'
          }`}
        >
          {isRecording ? <StopCircle size={48} /> : <Mic size={48} />}
        </button>
      </div>

      {/* Status Indicator */}
      {status === 'processing' && (
        <div className="flex items-center gap-2 text-secondary">
          <Loader2 className="animate-spin" />
          <span>جاري التحليل والفهرسة...</span>
        </div>
      )}
      {status === 'saved' && (
        <div className="text-green-400 font-bold">تم الحفظ بنجاح!</div>
      )}

      {/* Inputs */}
      <div className="w-full max-w-md space-y-4">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="أضف ملاحظة نصية أو وصفاً..."
            className="w-full bg-card/50 border border-white/10 rounded-xl p-4 pr-12 text-right focus:outline-none focus:border-primary resize-none h-24"
          />
          <button 
            onClick={handleTextSubmit}
            className="absolute left-3 bottom-3 p-2 bg-primary/20 hover:bg-primary/40 rounded-full text-primary transition-colors"
          >
            <Send size={18} />
          </button>
        </div>

        <div className="flex gap-3 justify-center">
            <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
            />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-card border border-white/10 rounded-full hover:bg-white/5 transition-colors"
          >
            <ImageIcon size={20} className="text-purple-400" />
            <span className="text-sm">إضافة صورة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
