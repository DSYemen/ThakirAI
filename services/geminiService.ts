import { GoogleGenAI, Type } from "@google/genai";
import { MemoryItem, MediaType } from "../types";

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

export const analyzeMedia = async (
  type: MediaType, 
  base64Data: string, 
  textContext: string = ""
): Promise<{ transcription: string; summary: string; tags: string[] }> => {
  
  const ai = getAI();
  const model = "gemini-2.5-flash"; // Efficient for multimodal

  let prompt = "قم بتحليل هذا المحتوى بدقة عالية. ";
  const parts: any[] = [];

  if (type === MediaType.AUDIO) {
    prompt += "قم بنسخ (Transcribe) الكلام بدقة، ثم لخص الموضوع، واستخرج أهم 5 وسوم.";
    parts.push({
      inlineData: {
        mimeType: "audio/mp3", // Generic audio container
        data: cleanBase64(base64Data)
      }
    });
  } else if (type === MediaType.IMAGE) {
    prompt += "صف الصورة بدقة، وحدد العناصر المرئية، الألوان، والمشاعر، واستخرج وسوم دقيقة.";
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanBase64(base64Data)
      }
    });
  } else if (type === MediaType.VIDEO) {
    prompt += "حلل هذا الفيديو. صف ما يحدث بصرياً وما يقال صوتياً. لخص الأحداث واستخرج وسوم.";
    parts.push({
      inlineData: {
        mimeType: "video/mp4", // Assume MP4/WebM compatible
        data: cleanBase64(base64Data)
      }
    });
  } else {
     prompt += "لخص هذا النص واستخرج الوسوم والمواضيع الرئيسية.";
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
            summary: { type: Type.STRING, description: "ملخص قصير ومركز (لا يزيد عن 30 كلمة)" },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "قائمة بـ 3-5 وسوم دقيقة" 
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      transcription: result.transcription || "",
      summary: result.summary || "",
      tags: result.tags || []
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { 
        transcription: "", 
        summary: "لم نتمكن من تحليل المحتوى تلقائياً.", 
        tags: ["مراجعة_يدوية"] 
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
    أنت نظام بحث ذكي للذكريات الشخصية.
    سؤال المستخدم: "${query}"

    قائمة الذكريات المتاحة:
    ${JSON.stringify(context)}

    المطلوب:
    1. "answer": إجابة نصية مباشرة ومختصرة على سؤال المستخدم بناءً على الذكريات.
    2. "results": قائمة بالذكريات ذات الصلة، بحيث:
       - "id": معرف الذكرى.
       - "score": نسبة المطابقة من 0 إلى 100 (حيث 100 تطابق تام).
       - "reason": سبب اختيار هذه الذكرى بكلمات قليلة (مثل: "ذكرى من نفس الموقع"، "تحتوي على الكلمة المفتاحية").
    
    رتب النتائج (results) تنازلياً حسب الـ score.
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
                        answer: { type: Type.STRING },
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