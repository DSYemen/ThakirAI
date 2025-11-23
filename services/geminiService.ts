import { GoogleGenAI, Type } from "@google/genai";
import { MemoryItem, MediaType } from "../types";

const getAI = () => {
    // In a real app, never expose keys. But per instructions, we use process.env.API_KEY
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

  let prompt = "قم بتحليل هذا المحتوى. ";
  const parts: any[] = [];

  if (type === MediaType.AUDIO) {
    prompt += "قم بنسخ (Transcribe) الصوت بدقة، ثم لخص ما قيل، واستخرج أهم 3-5 وسوم (tags) تصف المحتوى. ";
    parts.push({
      inlineData: {
        mimeType: "audio/mp3", // Assuming mp3/webm conversion or compatible container
        data: cleanBase64(base64Data)
      }
    });
  } else if (type === MediaType.IMAGE) {
    prompt += "صف هذه الصورة بدقة، ماذا يحدث فيها؟ استخرج وسوم تعبر عن المكان، الأشخاص، أو الحدث. ";
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanBase64(base64Data)
      }
    });
  } else {
     prompt += "لخص هذا النص واستخرج الوسوم. ";
  }

  if (textContext) {
    prompt += `\n ملاحظات المستخدم: ${textContext}`;
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
            transcription: { type: Type.STRING, description: "النص الكامل للصوت أو الوصف الدقيق للصورة" },
            summary: { type: Type.STRING, description: "ملخص قصير للمحتوى" },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "قائمة بالوسوم (Tags)" 
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
    return { transcription: "", summary: "فشل التحليل", tags: ["خطأ"] };
  }
};

export const smartSearch = async (query: string, memories: MemoryItem[]): Promise<string> => {
    const ai = getAI();
    
    // Create a lightweight context of memories (avoid sending huge base64 strings)
    const context = memories.map(m => ({
        id: m.id,
        date: new Date(m.createdAt).toLocaleDateString('ar-SA'),
        type: m.type,
        summary: m.summary,
        transcription: m.transcription?.substring(0, 200), // First 200 chars to save tokens
        tags: m.tags.join(", ")
    }));

    const prompt = `
    أنت مساعد ذاكرة شخصي ذكي. المستخدم يسألك عن ذكرياته.
    
    سؤال المستخدم: "${query}"

    قائمة الذكريات المتوفرة (JSON):
    ${JSON.stringify(context)}

    التعليمات:
    1. ابحث في الذكريات عن إجابة لسؤال المستخدم.
    2. إذا وجدت ذكريات مرتبطة، أشر إليها وتحدث عنها.
    3. إذا كان السؤال عاماً (مثل "لخص أسبوعي")، قم بتلخيص الذكريات.
    4. رد باللغة العربية بأسلوب ودود ومختصر.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text || "لم أستطع معالجة طلبك حالياً.";
    } catch (e) {
        console.error(e);
        return "حدث خطأ أثناء البحث الذكي.";
    }
};
