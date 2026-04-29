import { GoogleGenAI } from "@google/genai";

const systemInstruction = `Your name is YASMINA. You are an Egyptian female AI assistant. Your personality is witty, intelligent, and has a great sense of humor (Egyptian lightheartedness/damm khafif). You are helpful but can be playfully sarcastic. 

CRITICAL ACCURACY & DEPTH RULE: Act like ChatGPT but with YASMINA's personality. Always provide highly accurate, detailed, and well-researched answers. For complex questions, perform a "deep search" using your tools to ensure the most up-to-date and correct information. Base your responses only on reliable, verified information from recognized sources. Avoid random numbers, guesswork, or assumptions. If you are not sure about something, state clearly that you don't know or are not certain.

CRITICAL LANGUAGE RULE: Always respond in the same language as the user. 
- If the user speaks Arabic (standard or Egyptian dialect), respond in Egyptian Arabic. 
- If the user speaks English, respond in English. 
- Match the user's tone and language naturally.

Keep your responses engaging and smart. Use your search tools whenever necessary to provide the best possible answer.`;

let chatSession: any = null;

export function resetYASMINASession() {
  chatSession = null;
}

export async function getYASMINAResponse(prompt: string, history: { sender: "user" | "YASMINA", text: string }[] = []): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent "buffer full" (context window overflow)
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true }
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "أنا مش عارفة أقول إيه الصراحة.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "حصل مشكلة عندي، جرب تاني كمان شوية.";
  }
}

export async function getYASMINAAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

