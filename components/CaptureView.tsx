import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Mic, Type, Check, Loader2, Bell, X, Calendar, Sparkles } from 'lucide-react';
import { analyzeMedia } from '../services/geminiService';
import { saveMemory } from '../services/db';
import { MediaType, MemoryItem, Reminder, ReminderFrequency } from '../types';

type CaptureMode = 'AUDIO' | 'VIDEO' | 'IMAGE' | 'TEXT';

export const CaptureView: React.FC = () => {
  const [mode, setMode] = useState<CaptureMode>('AUDIO');
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<string>(""); 
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [autoReminderDetected, setAutoReminderDetected] = useState<boolean>(false);
  
  // Reminder State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderFreq, setReminderFreq] = useState<ReminderFrequency>('ONCE');
  const [activeReminder, setActiveReminder] = useState<Reminder | undefined>(undefined);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Camera for Video/Image modes
  useEffect(() => {
    if (mode === 'VIDEO' || mode === 'IMAGE') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: mode === 'VIDEO' 
      });
      setPreviewStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error("Camera Access Error", e);
      alert("يرجى السماح بالوصول للكاميرا");
    }
  };

  const stopCamera = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
  };

  const startRecording = async () => {
    chunksRef.current = [];
    
    let stream = previewStream;
    if (mode === 'AUDIO') {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch(e) {
            alert("يرجى السماح بالوصول للميكروفون");
            return;
        }
    }

    if (!stream) return;

    const mimeType = mode === 'VIDEO' ? 'video/webm;codecs=vp8,opus' : 'audio/webm';
    const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;

    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = handleRecordingStop;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (mode === 'AUDIO') {
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const context = canvasRef.current.getContext('2d');
    const video = videoRef.current;
    
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;
    context?.drawImage(video, 0, 0);
    
    canvasRef.current.toBlob(async (blob) => {
        if (blob) {
             processAndSave(blob, MediaType.IMAGE, 'image/jpeg');
        }
    }, 'image/jpeg', 0.8);
  };

  const handleRecordingStop = () => {
      const type = mode === 'VIDEO' ? 'video/webm' : 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      processAndSave(blob, mode === 'VIDEO' ? MediaType.VIDEO : MediaType.AUDIO, type);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processAndSave = async (blob: Blob, type: MediaType, mimeType: string) => {
      setStatus("processing");
      try {
        const base64 = await blobToBase64(blob);
        const analysis = await analyzeMedia(type, base64, inputText);

        let finalReminder = activeReminder;
        // Auto-detect reminder logic
        if (!finalReminder && analysis.detectedReminder) {
            finalReminder = {
                timestamp: new Date(analysis.detectedReminder.isoTimestamp).getTime(),
                frequency: analysis.detectedReminder.frequency
            };
            setAutoReminderDetected(true);
        }

        const memory: MemoryItem = {
            id: crypto.randomUUID(),
            type,
            content: base64,
            createdAt: Date.now(),
            transcription: analysis.transcription,
            summary: analysis.summary,
            tags: analysis.tags,
            metadata: { mimeType },
            reminder: finalReminder
        };

        await saveMemory(memory);
        resetForm();
      } catch (error) {
          console.error(error);
          setStatus("error");
      }
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;
    setStatus("processing");
    const analysis = await analyzeMedia(MediaType.TEXT, "", inputText);
    
    let finalReminder = activeReminder;
    // Auto-detect reminder logic
    if (!finalReminder && analysis.detectedReminder) {
        finalReminder = {
            timestamp: new Date(analysis.detectedReminder.isoTimestamp).getTime(),
            frequency: analysis.detectedReminder.frequency
        };
        setAutoReminderDetected(true);
    }

    const memory: MemoryItem = {
        id: crypto.randomUUID(),
        type: MediaType.TEXT,
        content: inputText,
        createdAt: Date.now(),
        transcription: inputText,
        summary: analysis.summary,
        tags: analysis.tags,
        reminder: finalReminder
    };

    await saveMemory(memory);
    resetForm();
  };

  const resetForm = () => {
      setStatus("saved");
      setInputText("");
      setActiveReminder(undefined);
      setTimeout(() => {
          setStatus("");
          setAutoReminderDetected(false);
      }, 3000);
  };

  const saveReminder = () => {
      if (reminderDate) {
          setActiveReminder({
              timestamp: new Date(reminderDate).getTime(),
              frequency: reminderFreq
          });
      } else {
          setActiveReminder(undefined);
      }
      setShowReminderModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-dark relative overflow-hidden">
        {/* Camera Preview Layer */}
        {(mode === 'VIDEO' || mode === 'IMAGE') && (
             <div className="absolute inset-0 z-0">
                 <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover opacity-90"
                 />
                 <canvas ref={canvasRef} className="hidden" />
                 <div className="absolute inset-0 bg-gradient-to-b from-dark/60 via-transparent to-dark/90 pointer-events-none" />
             </div>
        )}

        {/* Top Header */}
        <div className="relative z-10 p-4 flex justify-between items-center">
             <h2 className="text-lg font-bold text-white drop-shadow-md">
                 {mode === 'AUDIO' && 'تسجيل صوتي'}
                 {mode === 'VIDEO' && 'تسجيل فيديو'}
                 {mode === 'IMAGE' && 'التقاط صورة'}
                 {mode === 'TEXT' && 'تدوين ملاحظة'}
             </h2>
             {status === 'processing' && (
                 <div className="bg-black/50 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2 text-xs text-secondary">
                     <Loader2 size={12} className="animate-spin" />
                     <span>جاري المعالجة والتحليل...</span>
                 </div>
             )}
             {status === 'saved' && (
                 <div className="flex flex-col items-end gap-1">
                     <div className="bg-green-500/20 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2 text-xs text-green-400 border border-green-500/30">
                         <Check size={12} />
                         <span>تم الحفظ</span>
                     </div>
                     {autoReminderDetected && (
                         <div className="bg-secondary/20 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2 text-xs text-secondary border border-secondary/30 animate-in slide-in-from-top-2">
                             <Sparkles size={12} />
                             <span>تم جدولة تذكير تلقائياً</span>
                         </div>
                     )}
                 </div>
             )}
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col justify-center items-center relative z-10 px-6">
            
            {mode === 'AUDIO' && (
                <div className={`transition-all duration-500 ${isRecording ? 'scale-110' : 'scale-100'}`}>
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-4 border-white/5 relative">
                         {isRecording && <div className="absolute inset-0 rounded-full animate-ping bg-primary/20"></div>}
                         <Mic size={64} className="text-white/80" />
                    </div>
                    {isRecording && <p className="text-center mt-8 text-primary font-mono animate-pulse">00:00:00</p>}
                </div>
            )}

            {mode === 'TEXT' && (
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="بماذا تفكر الآن؟ (مثال: ذكرني بموعد الطبيب غداً)"
                    className="w-full h-64 bg-card/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-xl leading-relaxed text-right focus:outline-none focus:border-primary/50 resize-none shadow-xl placeholder:text-gray-500"
                />
            )}
        </div>

        {/* Bottom Controls */}
        <div className="relative z-20 bg-dark/80 backdrop-blur-xl border-t border-white/5 pb-24 pt-6 rounded-t-3xl">
            
            {/* Mode Selector */}
            <div className="flex justify-center gap-6 mb-8">
                {[
                    { id: 'AUDIO', icon: Mic, label: 'صوت' },
                    { id: 'VIDEO', icon: Video, label: 'فيديو' },
                    { id: 'IMAGE', icon: Camera, label: 'صورة' },
                    { id: 'TEXT', icon: Type, label: 'نص' },
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => !isRecording && setMode(m.id as CaptureMode)}
                        className={`flex flex-col items-center gap-2 transition-all duration-300 ${mode === m.id ? 'text-white -translate-y-1' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className={`p-3 rounded-full ${mode === m.id ? 'bg-white/10' : 'bg-transparent'}`}>
                            <m.icon size={20} />
                        </div>
                        <span className="text-[10px] font-medium">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* Action Button */}
            <div className="flex flex-col items-center gap-4 px-6">
                
                {mode === 'TEXT' ? (
                     <button 
                        onClick={handleTextSubmit}
                        disabled={!inputText.trim()}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                     >
                        حفظ الملاحظة
                     </button>
                ) : (
                    <div className="flex items-center gap-4 w-full justify-center">
                        <button
                            onClick={() => {
                                if (mode === 'IMAGE') captureImage();
                                else if (isRecording) stopRecording();
                                else startRecording();
                            }}
                            className={`w-20 h-20 rounded-full flex items-center justify-center border-4 border-white transition-all duration-300 shadow-2xl ${
                                isRecording 
                                ? 'bg-red-500 scale-110' 
                                : mode === 'IMAGE' 
                                    ? 'bg-white text-dark' 
                                    : 'bg-gradient-to-r from-primary to-secondary'
                            }`}
                        >
                            {isRecording ? (
                                <div className="w-6 h-6 bg-white rounded-sm" />
                            ) : mode === 'IMAGE' ? (
                                <div className="w-16 h-16 rounded-full border-2 border-dark/20" />
                            ) : (
                                <div className="w-6 h-6 bg-white rounded-full" />
                            )}
                        </button>
                    </div>
                )}
                
                {/* Secondary Inputs Row */}
                <div className="flex items-center gap-2 w-full">
                     {/* Reminder Button */}
                     <button 
                        onClick={() => setShowReminderModal(true)}
                        className={`p-3 rounded-full border transition-colors ${activeReminder ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                     >
                         <Bell size={20} fill={activeReminder ? "currentColor" : "none"} />
                     </button>

                    {/* Context Input */}
                    {mode !== 'TEXT' && (
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="أضف وصفاً اختيارياً..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-full py-3 px-4 text-center text-sm focus:outline-none focus:bg-white/10 transition-colors"
                        />
                    )}
                </div>
            </div>
        </div>

        {/* Reminder Modal */}
        {showReminderModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-card w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Calendar size={18} className="text-secondary" />
                            تذكير بالذكرى
                        </h3>
                        <button onClick={() => setShowReminderModal(false)} className="text-gray-400 hover:text-white">
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
                            تأكيد التذكير
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};