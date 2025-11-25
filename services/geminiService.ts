import { GoogleGenAI, Type } from "@google/genai";
import { MemoryItem, MediaType, ReminderFrequency } from "../types";

const getAI = () => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to clean base64 string
const cleanBase64 = (data: string) => {
  return data.replace(/^data:.*?;base64,/, '');
};

interface AnalysisResult {
    transcription: string;
    summary: string;
    tags: string[];
    detectedReminder?: {
        isoTimestamp: string;
        frequency: ReminderFrequency;
    } | null;
}

export const analyzeMedia = async (
  type: MediaType, 
  base64Data: string, 
  textContext: string = ""
): Promise<AnalysisResult> => {
  
  const ai = getAI();
  const model = "gemini-2.5-flash"; 

  const now = new Date();
  const currentContext = `
  التوقيت الحالي للمستخدم هو: ${now.toISOString()} (${now.toLocaleDateString('en-US', { weekday: 'long' })}).
  استخدم هذا التوقيت لحساب أي تواريخ نسبية بدقة (مثال: "غداً"، "الجمعة القادم"، "بعد ساعة").
  `;

  let prompt = "قم بتحليل هذا المحتوى بدقة عالية. " + currentContext;
  const parts: any[] = [];

  if (type === MediaType.AUDIO) {
    prompt += "قم بنسخ (Transcribe) الكلام بدقة، لخص الموضوع، استخرج الوسوم. إذا ذكر المستخدم موعداً للتذكير أو تكراراً (مثال: ذكرني كل يوم، موعد الطبيب غداً)، استخرج بيانات التذكير.";
    parts.push({
      inlineData: {
        mimeType: "audio/mp3", 
        data: cleanBase64(base64Data)
      }
    });
  } else if (type === MediaType.IMAGE) {
    prompt += "صف الصورة، حدد العناصر، استخرج وسوم. إذا كانت الصورة تحتوي على نص لموعد (مثال: دعوة، تذكرة، ورقة ملاحظات)، استخرج بيانات التذكير.";
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanBase64(base64Data)
      }
    });
  } else if (type === MediaType.VIDEO) {
    prompt += "حلل الفيديو بصرياً وصوتياً. استخرج وسوم. إذا تم ذكر موعد أو ظهر تاريخ مهم، استخرج بيانات التذكير.";
    parts.push({
      inlineData: {
        mimeType: "video/mp4", 
        data: cleanBase64(base64Data)
      }
    });
  } else {
     prompt += "لخص النص، استخرج الوسوم. إذا طلب المستخدم تذكيراً (مثال: 'ذكرني شراء الحليب مساءً')، استخرج بيانات التذكير.";
  }

  if (textContext) {
    prompt += `\n سياق إضافي من المستخدم: ${textContext}`;
  }

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING, description: "النص الكامل أو الوصف الدقيق" },
            summary: { type: Type.STRING, description: "ملخص قصير ومركز" },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3-5 وسوم دقيقة" 
            },
            detectedReminder: {
                type: Type.OBJECT,
                nullable: true,
                description: "يملأ فقط إذا تم اكتشاف نية تذكير صريحة",
                properties: {
                    isoTimestamp: { type: Type.STRING, description: "تاريخ ووقت التذكير بصيغة ISO 8601" },
                    frequency: { 
                        type: Type.STRING, 
                        enum: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
                        description: "نوع التكرار" 
                    }
                }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      transcription: result.transcription || "",
      summary: result.summary || "",
      tags: result.tags || [],
      detectedReminder: result.detectedReminder || null
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { 
        transcription: "", 
        summary: "لم نتمكن من تحليل المحتوى تلقائياً.", 
        tags: ["مراجعة_يدوية"],
        detectedReminder: null
    };
  }
};

export const smartSearch = async (query: string, memories: MemoryItem[]): Promise<{ answer: string; results: { id: string; score: number; reason: string }[] }> => {
    const ai = getAI();
    
    // Optimized context to save tokens
    const context = memories.map(m => ({
        id: m.id,
        date: new Date(m.createdAt).toLocaleDateString('ar-SA'),
        type: m.type,
        summary: m.summary || "لا يوجد وصف",
        text: m.type === MediaType.TEXT ? m.content.substring(0, 300) : m.transcription?.substring(0, 300) || "",
        tags: m.tags.join(", ")
    }));

    const prompt = `
    أنت مساعد ذكي للذكريات الشخصية. هدفك هو مساعدة المستخدم في استرجاع المعلومات من ذكرياته المسجلة.
    
    سؤال المستخدم: "${query}"

    قائمة الذكريات المتاحة (Context):
    ${JSON.stringify(context)}

    المطلوب:
    1. "answer": قم بصياغة إجابة طبيعية، شاملة، ومفيدة باللغة العربية. 
       - استخدم المعلومات الموجودة في الذكريات للإجابة على السؤال.
       - إذا وجدت الإجابة في عدة ذكريات، قم بتجميعها في فقرة متماسكة.
       - إذا لم تجد إجابة دقيقة، اعتذر بلطف واذكر أقرب معلومة إن وجدت.
    
    2. "results": اختر الذكريات التي استندت إليها في إجابتك أو التي لها صلة قوية بالسؤال.
       - "id": معرف الذكرى.
       - "score": نسبة المطابقة (0-100).
       - "reason": لماذا اخترت هذه الذكرى (شرح قصير).
    
    رتب النتائج (results) تنازلياً حسب الأهمية.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: { type: Type.STRING, description: "الإجابة الكاملة والمجمعة" },
                        results: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    score: { type: Type.NUMBER },
                                    reason: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(response.text || "{}");
        return {
            answer: json.answer || "لم أجد إجابة دقيقة في ذكرياتك.",
            results: json.results || []
        };
    } catch (e) {
        console.error(e);
        return { 
            answer: "حدث خطأ في الاتصال بالمساعد الذكي.", 
            results: [] 
        };
    }
};