
import { GoogleGenAI, Type } from "@google/genai";
import { MemoryItem, MediaType, ReminderFrequency } from "../types";
import { getSettings } from "./settingsService";

const getAI = () => {
    const settings = getSettings();
    // Prioritize User API Key, fallback to env
    const apiKey = settings.apiKey || process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("API Key is missing. Please add it in settings.");
    }
    return new GoogleGenAI({ apiKey });
};

const getModelName = () => {
    const settings = getSettings();
    return settings.aiModel || "gemini-2.5-flash";
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
  
  try {
    const ai = getAI();
    const model = getModelName();
    const settings = getSettings();
    const timeZone = settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = settings.language || 'ar-SA';
    const langName = language.startsWith('ar') ? 'Arabic' : 'English';

    const now = new Date();
    // Format date specifically for the user's timezone to give Gemini the correct context
    const userTime = now.toLocaleString('en-US', { timeZone: timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });

    const currentContext = `
    Context:
    - User's Timezone: ${timeZone}
    - Current User Time: ${userTime}
    - User's Language Preference: ${langName} (${language})
    
    Instructions:
    1. Analyze the content deeply.
    2. Transcribe any speech or text accurately in its original language.
    3. Provide the 'summary' and 'tags' in ${langName}.
    4. Detect any reminders relative to the User's Current Time provided above.
       - Example: If user says "tomorrow at 9am", calculate the ISO timestamp based on ${userTime} in ${timeZone}.
    `;

    let prompt = currentContext;
    const parts: any[] = [];

    if (type === MediaType.AUDIO) {
        prompt += "\nTask: Transcribe speech, summarize, extract tags. If a reminder is mentioned (e.g., 'remind me everyday', 'doctor appointment tomorrow'), extract reminder data.";
        parts.push({
        inlineData: {
            mimeType: "audio/mp3", 
            data: cleanBase64(base64Data)
        }
        });
    } else if (type === MediaType.IMAGE) {
        prompt += "\nTask: Describe image, identify objects/text, extract tags. If image contains event info (ticket, invitation, note), extract reminder data.";
        parts.push({
        inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64(base64Data)
        }
        });
    } else if (type === MediaType.VIDEO) {
        prompt += "\nTask: Analyze video visually and audibly. Summarize, extract tags. If an event or date is mentioned, extract reminder data.";
        parts.push({
        inlineData: {
            mimeType: "video/mp4", 
            data: cleanBase64(base64Data)
        }
        });
    } else {
        prompt += "\nTask: Summarize text, extract tags. If a reminder is requested (e.g., 'remind me to buy milk tonight'), extract reminder data.";
    }

    if (textContext) {
        prompt += `\nAdditional User Context: ${textContext}`;
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING, description: "Full transcription or detailed description" },
            summary: { type: Type.STRING, description: "Concise summary in user's language" },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3-5 relevant tags" 
            },
            detectedReminder: {
                type: Type.OBJECT,
                nullable: true,
                description: "Fill only if a clear reminder intention is detected",
                properties: {
                    isoTimestamp: { type: Type.STRING, description: "ISO 8601 timestamp (UTC) of the reminder event" },
                    frequency: { 
                        type: Type.STRING, 
                        enum: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
                        description: "Recurrence frequency" 
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
        summary: "لم نتمكن من تحليل المحتوى تلقائياً (تأكد من إعدادات API Key).", 
        tags: ["خطأ_تحليل"],
        detectedReminder: null
    };
  }
};

export const smartSearch = async (query: string, memories: MemoryItem[]): Promise<{ answer: string; results: { id: string; score: number; reason: string }[] }> => {
    try {
        const ai = getAI();
        const model = getModelName();
        const settings = getSettings();
        const timeZone = settings.timeZone || 'Asia/Riyadh';
        const language = settings.language || 'ar-SA';
        const langName = language.startsWith('ar') ? 'Arabic' : 'English';
        
        // Optimized context to save tokens
        const context = memories.map(m => ({
            id: m.id,
            date: new Date(m.createdAt).toLocaleDateString(language, { timeZone }),
            type: m.type,
            summary: m.summary || "No description",
            text: m.type === MediaType.TEXT ? m.content.substring(0, 300) : m.transcription?.substring(0, 300) || "",
            tags: m.tags.join(", ")
        }));

        const prompt = `
        Role: Personal Memory Assistant.
        User's Timezone: ${timeZone}.
        User's Current Time: ${new Date().toLocaleString(language, { timeZone })}.
        Target Language: ${langName}.
        
        User Query: "${query}"

        Available Memories (Context):
        ${JSON.stringify(context)}

        Task:
        1. "answer": Formulate a comprehensive, helpful, and natural answer in ${langName}.
           - Use the provided memories to answer the query.
           - Synthesize information from multiple memories if needed.
           - If no answer found, politely apologize in ${langName}.
        
        2. "results": Select relevant memories.
           - "id": memory id.
           - "score": relevance score (0-100).
           - "reason": brief reason for selection in ${langName}.
        
        Sort results by relevance score descending.
        `;

        const response = await ai.models.generateContent({
            model: model, 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: { type: Type.STRING, description: "The comprehensive answer" },
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
            answer: "حدث خطأ في الاتصال بالمساعد الذكي (تأكد من إعدادات API Key والإنترنت).", 
            results: [] 
        };
    }
};
