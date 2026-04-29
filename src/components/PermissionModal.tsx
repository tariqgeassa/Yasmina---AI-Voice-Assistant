import React from 'react';
import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function PermissionModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 via-pink-500 to-red-500" />
        
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping opacity-20" />
          <MicOff size={36} className="text-red-400 relative z-10" />
        </div>
        
        <h2 className="text-3xl font-serif font-medium text-white mb-4 tracking-tight">Microphone Setup Required</h2>
        <p className="text-white/50 text-base mb-10 max-w-sm leading-relaxed">
          To talk with YASMINA, your browser needs permission to use your microphone. This is a security feature to protect your privacy.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
          {[
            { step: "1", text: "Click the icon next to the URL bar", icon: "🔒" },
            { step: "2", text: "Toggle Microphone to 'Allow'", icon: "🎙️" },
            { step: "3", text: "Refresh current page", icon: "🔄" }
          ].map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2">
              <span className="text-2xl mb-1">{item.icon}</span>
              <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Step {item.step}</p>
              <p className="text-xs text-white/70 leading-snug">{item.text}</p>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col w-full gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-violet-500/20"
          >
            I've allowed it, Refresh Now
          </button>
          <button 
            onClick={onClose}
            className="w-full py-4 px-6 bg-white/5 text-white/40 font-medium rounded-2xl hover:bg-white/10 hover:text-white/60 transition-all text-sm"
          >
            I'll use text for now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
