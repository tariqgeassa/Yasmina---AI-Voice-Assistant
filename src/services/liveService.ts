/// <reference types="vite/client" />
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Your name is YASMINA. You are an Egyptian female AI assistant. Your personality is witty, intelligent, and has a great sense of humor (Egyptian lightheartedness/damm khafif). You are helpful but can be playfully sarcastic. 

CRITICAL ACCURACY & DEPTH RULE: Act like ChatGPT but with YASMINA's personality. Always provide highly accurate, detailed, and well-researched answers. For complex questions, perform a "deep search" using your tools to ensure the most up-to-date and correct information. Base your responses only on reliable, verified information from recognized sources. Avoid random numbers, guesswork, or assumptions. If you are not sure about something, state clearly that you don't know or are not certain.

CRITICAL LANGUAGE RULE: Always respond in the same language as the user. 
- If the user speaks Arabic (standard or Egyptian dialect), respond in Egyptian Arabic. 
- If the user speaks English, respond in English. 
- Match the user's tone and language naturally.

Keep your responses engaging and smart. Use your search tools whenever necessary to provide the best possible answer.`;

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isUserStopped: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "YASMINA", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};

  constructor() {
    const apiKey = (import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. AI features will not work.");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || 'missing-key' });
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("MICROPHONE_NOT_SUPPORTED");
    }
    this.isUserStopped = false;
    await this.connect();
  }

  private async connect() {
    try {
      if (this.isUserStopped) return;
      
      const apiKey = (import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');
      if (!apiKey) {
        throw new Error("MISSING_API_KEY");
      }
      this.onStateChange("processing");
      
      // Initialize Audio Contexts if not already done
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      } else if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.playbackContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
        this.nextPlayTime = this.playbackContext.currentTime;
      } else if (this.playbackContext.state === 'suspended') {
        await this.playbackContext.resume();
      }

      // Get Microphone if not already done
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });

        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
          if (!this.sessionPromise || this.isUserStopped) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Convert to base64
          const buffer = new ArrayBuffer(pcm16.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < pcm16.length; i++) {
            view.setInt16(i * 2, pcm16[i], true);
          }
          
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          this.sessionPromise.then(session => {
            if (session && !this.isUserStopped) {
              session.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            }
          }).catch(() => {});
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
      }

      // Connect to Live API
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            { googleSearch: {} },
            {
              functionDeclarations: [
                {
                  name: "executeBrowserAction",
                  description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                      query: { type: Type.STRING, description: "The search query, website name, or message content." },
                      target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                    },
                    required: ["actionType", "query"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.reconnectAttempts = 0;
            this.onStateChange("listening");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (this.isUserStopped) return;
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions
            const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (userText) {
               this.onMessage("YASMINA", userText);
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            if (!this.isUserStopped) {
              this.handleReconnect();
            } else {
              this.cleanup();
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            if (!this.isUserStopped) {
              this.handleReconnect();
            } else {
              this.cleanup();
            }
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      if (!this.isUserStopped) {
        this.handleReconnect();
      } else {
        this.cleanup();
      }
    }
  }

  private handleReconnect() {
    if (this.isUserStopped) return;
    
    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.stop();
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isUserStopped) {
        this.connect();
      }
    }, delay);
  }

  private cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  stop() {
    this.isUserStopped = true;
    this.cleanup();
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}
