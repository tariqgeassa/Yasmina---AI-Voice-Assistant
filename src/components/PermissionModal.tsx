import React from 'react';
import { motion } from 'motion/react';
import { MicOff, Key, MonitorOff } from 'lucide-react';

interface Props {
  onClose: () => void;
  type?: "microphone" | "api_key" | "unsupported";
}

export default function PermissionModal({ onClose, type = "microphone" }: Props) {
  const content = {
    microphone: {
      icon: <MicOff size={32} className="text-red-400" />,
      title: "Microphone Blocked",
      description: "Your browser has blocked microphone access for this site. YASMINA cannot hear you until you allow it.",
      steps: [
        "Click the lock icon (🔒) next to the URL bar.",
        "Find Microphone and change it to Allow.",
        "Refresh this page."
      ],
      button: "I've allowed it, Refresh Page",
      retryButton: "Try Requesting Permission"
    },
    api_key: {
      icon: <Key size={32} className="text-amber-400" />,
      title: "API Key Missing",
      description: "YASMINA needs a Gemini API Key to function in this standalone deployment.",
      steps: [
        "Go to your Vercel Dashboard / Project Settings.",
        "Add an Environment Variable: VITE_GEMINI_API_KEY.",
        "Redeploy your application."
      ],
      button: "Got it",
      retryButton: null
    },
    unsupported: {
      icon: <MonitorOff size={32} className="text-gray-400" />,
      title: "Not Supported",
      description: "Your browser or device doesn't support the required microphone APIs.",
      steps: [
        "Try using a modern browser like Chrome or Safari.",
        "Ensure you are using HTTPS (Vercel normally provides this).",
        "Check your device's audio input settings."
      ],
      button: "Close",
      retryButton: null
    }
  };

  const handleRetryMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone access granted');
      window.location.reload();
    } catch (err) {
      console.error('Microphone access denied', err);
      alert("Microphone still blocked. Please check your browser settings manually.");
    }
  };

  const active = content[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${type === 'api_key' ? 'from-amber-500 to-yellow-500' : 'from-red-500 to-orange-500'}`} />
        
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${type === 'api_key' ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
          {active.icon}
        </div>
        
        <h2 className="text-2xl font-serif font-medium text-white mb-3 tracking-tight">{active.title}</h2>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          {active.description}
        </p>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left w-full mb-8">
          <p className="text-sm text-white/80 font-medium mb-2">How to fix this:</p>
          <ol className="text-xs text-white/60 list-decimal pl-4 space-y-2">
            {active.steps.map((step, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
            ))}
          </ol>
        </div>
        
        <div className="flex flex-col w-full gap-3">
          {type === 'microphone' && active.retryButton && (
            <button 
              onClick={handleRetryMic}
              className="w-full py-3 px-4 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-colors flex items-center justify-center gap-2"
            >
              <MicOff size={18} />
              {active.retryButton}
            </button>
          )}
          <button 
            onClick={() => type === 'microphone' ? window.location.reload() : onClose()}
            className="w-full py-3 px-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            {active.button}
          </button>
          {type === 'microphone' && (
            <button 
              onClick={onClose}
              className="w-full py-3 px-4 bg-white/5 text-white/70 font-medium rounded-xl hover:bg-white/10 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
