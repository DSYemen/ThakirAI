
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Mic, Type, Check, Loader2, Bell, X, Calendar, Sparkles, CalendarDays, AlertCircle, CameraOff, MicOff, RefreshCw, Settings } from 'lucide-react';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { analyzeMedia } from '../services/geminiService';
import { saveMemory } from '../services/db';
import { generateGoogleCalendarLink } from '../services/calendarService';
import { MediaType, MemoryItem, Reminder, ReminderFrequency } from '../types';

type CaptureMode = 'AUDIO' | 'VIDEO' | 'IMAGE' | 'TEXT';

export const CaptureView: React.FC = () => {
  const [mode, setMode] = useState<CaptureMode>('AUDIO');
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<string>(""); 
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [autoReminderDetected, setAutoReminderDetected] = useState<boolean>(false);
  
  // Device Error State
  const [deviceError, setDeviceError] = useState<{ type: 'CAMERA' | 'MIC', message: string } | null>(null);

  // Reminder State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderFreq, setReminderFreq] = useState<ReminderFrequency>('ONCE');
  const [activeReminder, setActiveReminder] = useState<Reminder | undefined>(undefined);

  // Confirmation State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<{
    blob?: Blob;
    type: MediaType;
    mimeType?: string;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Camera for Video/Image modes
  useEffect(() => {
    setDeviceError(null); // Clear errors when switching modes
    if (mode === 'VIDEO' || mode === 'IMAGE') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const requestNativePermissions = async () => {
    try {
        // Request Camera Permission explicitly for Android
        const camStatus = await CapacitorCamera.checkPermissions();
        if (camStatus.camera !== 'granted') {
            await CapacitorCamera.requestPermissions({ permissions: ['camera', 'photos'] });
        }
    } catch (e) {
        console.warn("Capacitor permission check skipped (web mode)");
    }
  };

  const startCamera = async () => {
    setDeviceError(null);
    
    await requestNativePermissions();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDeviceError({ type: 'CAMERA', message: "عذراً، متصفحك لا يدعم الوصول للكاميرا أو أن الاتصال غير آمن (HTTPS مطلوب)." });
        return;
    }

    try {
      // For video mode, we try to get audio permission as well initially
      const constraints = {
          video: { facingMode: 'environment' },
          audio: mode === 'VIDEO'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setPreviewStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      console.error("Camera Access Error", e);
      let msg = "حدث خطأ غير متوقع أثناء تشغيل الكاميرا.";
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          msg = "تم رفض إذن الوصول للكاميرا. يرجى السماح بذلك من إعدادات التطبيق أو المتصفح.";
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
          msg = "لم يتم العثور على كاميرا في هذا الجهاز.";
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
          msg = "الكاميرا مستخدمة بالفعل من قبل تطبيق آخر. أغلق التطبيقات الأخرى وحاول مرة أخرى.";
      }
      setDeviceError({ type: 'CAMERA', message: msg });
    }
  };

  const stopCamera = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
  };

  const startRecording = async () => {
    setDeviceError(null);
    chunksRef.current = [];
    
    // Check API support first
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDeviceError({ type: mode === 'AUDIO' ? 'MIC' : 'CAMERA', message: "عذراً، جهازك لا يدعم التسجيل." });
        return;
    }

    let stream = previewStream;
    if (mode === 'AUDIO') {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch(e: any) {
            console.error("Mic Access Error", e);
            let msg = "حدث خطأ أثناء تشغيل الميكروفون.";
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                msg = "تم رفض إذن الميكروفون. يرجى الذهاب إلى إعدادات الهاتف -> التطبيقات -> الذاكرة الذكية -> ومنح إذن الميكروفون.";
            } else if (e.name === 'NotFoundError') {
                msg = "لم يتم العثور على ميكروفون.";
            }
            setDeviceError({ type: 'MIC', message: msg });
            return;
        }
    }

    if (!stream) {
        if (mode !== 'AUDIO' && !deviceError) {
             // Retry starting camera if stream is missing in video mode (and no error yet)
             startCamera();
        }
        return;
    }

    const mimeType = mode === 'VIDEO' ? 'video/webm;codecs=vp8,opus' : 'audio/webm';
    // Fallback for Safari/iOS which prefers mp4/aac or standard webm without codec specs
    const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;

    try {
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = handleRecordingStop;
        recorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error("MediaRecorder Error", err);
        setDeviceError({ type: mode === 'AUDIO' ? 'MIC' : 'CAMERA', message: "المتصفح لا يدعم التسجيل بهذه الصيغة." });
    }
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
             setPendingCapture({ blob, type: MediaType.IMAGE, mimeType: 'image/jpeg' });
             setShowConfirmModal(true);
        }
    }, 'image/jpeg', 0.8);
  };

  const handleRecordingStop = () => {
      const type = mode === 'VIDEO' ? 'video/webm' : 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      setPendingCapture({ blob, type: mode === 'VIDEO' ? MediaType.VIDEO : MediaType.AUDIO, mimeType: type });
      setShowConfirmModal(true);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const executeProcessAndSave = async (blob: Blob, type: MediaType, mimeType: string) => {
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

  const openTextConfirmation = () => {
    if (!inputText.trim()) return;
    setPendingCapture({ type: MediaType.TEXT });
    setShowConfirmModal(true);
  };

  const executeTextSave = async () => {
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

  const confirmSave = async () => {
      setShowConfirmModal(false);
      
      if (pendingCapture?.type === MediaType.TEXT) {
          await executeTextSave();
      } else if (pendingCapture?.blob && pendingCapture?.mimeType) {
          await executeProcessAndSave(pendingCapture.blob, pendingCapture.type, pendingCapture.mimeType);
      }
      setPendingCapture(null);
  };

  const cancelSave = () => {
      setShowConfirmModal(false);
      setPendingCapture(null);
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
        {/* Camera Preview Layer (OR Error Layer) */}
        {(mode === 'VIDEO' || mode === 'IMAGE') && (
             <div className="absolute inset-0 z-0 bg-black">
                 {deviceError?.type === 'CAMERA' ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                         <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                             <CameraOff size={32} className="text-red-400" />
                         </div>
                         <h3 className="text-lg font-bold text-white mb-2">تعذر الوصول للكاميرا</h3>
                         <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-xs">{deviceError.message}</p>
                         <button 
                            onClick={startCamera}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                         >
                             <RefreshCw size={14} />
                             إعادة المحاولة
                         </button>
                     </div>
                 ) : (
                    <>
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover opacity-90"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 bg-gradient-to-b from-dark/60 via-transparent to-dark/90 pointer-events-none" />
                    </>
                 )}
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
                         <div className="bg-secondary/20 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2 text-xs text-secondary border border-secondary/30 animate-in slide-in-from-top-2 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                             <Bell size={12} className="animate-pulse" fill="currentColor" />
                             <span>تم ضبط التذكير</span>
                         </div>
                     )}
                 </div>
             )}
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col justify-center items-center relative z-10 px-6">
            
            {mode === 'AUDIO' && (
                <div className={`transition-all duration-500 ${isRecording ? 'scale-110' : 'scale-100'}`}>
                    {deviceError?.type === 'MIC' ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                                <MicOff size={32} className="text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">تعذر الوصول للميكروفون</h3>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-xs">{deviceError.message}</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={startRecording}
                                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                >
                                    <RefreshCw size={14} />
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-4 border-white/5 relative">
                                {isRecording && <div className="absolute inset-0 rounded-full animate-ping bg-primary/20"></div>}
                                <Mic size={64} className="text-white/80" />
                            </div>
                            {isRecording ? (
                                <p className="text-center mt-8 text-primary font-mono animate-pulse">جاري التسجيل...</p>
                            ) : (
                                <p className="text-center mt-8 text-gray-500 text-sm">اضغط على الزر أدناه لبدء التسجيل</p>
                            )}
                        </>
                    )}
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
                        onClick={openTextConfirmation}
                        disabled={!inputText.trim()}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                     >
                        حفظ الملاحظة
                     </button>
                ) : (
                    <div className="flex items-center gap-4 w-full justify-center">
                        <button
                            onClick={() => {
                                if (deviceError) return; // Disable main button if error
                                if (mode === 'IMAGE') captureImage();
                                else if (isRecording) stopRecording();
                                else startRecording();
                            }}
                            disabled={!!deviceError}
                            className={`w-20 h-20 rounded-full flex items-center justify-center border-4 border-white transition-all duration-300 shadow-2xl ${
                                !!deviceError ? 'bg-gray-500 opacity-50 cursor-not-allowed' :
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
                        
                         {/* Calendar Button inside modal (Active only if date is selected) */}
                         {reminderDate && (
                             <div className="border-t border-white/10 pt-4 mt-2">
                                 <button
                                     onClick={() => {
                                        const tempMemory: MemoryItem = {
                                            id: 'temp', type: MediaType.TEXT, content: '', createdAt: Date.now(), tags: [],
                                            summary: 'تذكير جديد',
                                            reminder: { timestamp: new Date(reminderDate).getTime(), frequency: reminderFreq }
                                        };
                                        generateGoogleCalendarLink(tempMemory);
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

        {/* Confirmation Modal */}
        {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-card w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6 text-center space-y-6">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary">
                        {pendingCapture?.type === MediaType.TEXT ? <Type size={32}/> : 
                         pendingCapture?.type === MediaType.IMAGE ? <Camera size={32}/> :
                         pendingCapture?.type === MediaType.VIDEO ? <Video size={32}/> : <Mic size={32}/>}
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">تأكيد الحفظ</h3>
                        <p className="text-gray-400 text-sm">
                            {pendingCapture?.type === MediaType.TEXT 
                                ? 'هل تريد حفظ هذه الملاحظة؟' 
                                : 'هل تريد حفظ هذا المحتوى وتحليله؟'}
                        </p>
                    </div>

                    {/* Preview for Image */}
                    {pendingCapture?.type === MediaType.IMAGE && pendingCapture.blob && (
                         <div className="rounded-xl overflow-hidden border border-white/10 max-h-48 bg-black/20">
                             <img src={URL.createObjectURL(pendingCapture.blob)} className="w-full h-full object-contain" alt="Preview" />
                         </div>
                    )}

                    {/* Preview for Text */}
                    {pendingCapture?.type === MediaType.TEXT && (
                        <div className="bg-white/5 rounded-xl p-3 text-right text-xs text-gray-300 max-h-32 overflow-y-auto leading-relaxed border border-white/5">
                            {inputText}
                        </div>
                    )}

                    {/* Warning if Audio/Video */}
                    {(pendingCapture?.type === MediaType.AUDIO || pendingCapture?.type === MediaType.VIDEO) && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2 text-left">
                            <AlertCircle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                            <span className="text-[10px] text-yellow-200/80 leading-tight">
                                سيتم إرسال هذا التسجيل إلى الذكاء الاصطناعي لاستخراج النص والبيانات.
                            </span>
                        </div>
                    )}

                    {/* Set Reminder Button inside Confirmation */}
                    <button 
                        onClick={() => setShowReminderModal(true)}
                        className={`w-full py-3 rounded-xl font-medium transition-colors border flex items-center justify-center gap-2 ${
                            activeReminder 
                            ? 'bg-secondary/20 text-secondary border-secondary/50' 
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                    >
                        <Bell size={16} fill={activeReminder ? "currentColor" : "none"} className={activeReminder ? "animate-pulse" : ""} />
                        {activeReminder ? 'تم ضبط التذكير' : 'إضافة تذكير لهذا التسجيل'}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={cancelSave}
                            className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                        >
                            إلغاء
                        </button>
                        <button 
                            onClick={confirmSave}
                            className="py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors shadow-lg shadow-primary/20"
                        >
                            حفظ ومتابعة
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
