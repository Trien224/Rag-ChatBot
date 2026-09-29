import React from 'react';

/**
 * NTU EduBot Official Icon & Mascot Emblem
 * Features an academic graduation cap combined with smart AI bot elements
 * with university blue, indigo, and gold accents.
 */
export const NtuEduBotIcon: React.FC<{ className?: string }> = ({ 
  className = "w-6 h-6",
}) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="ntuGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="45%" stopColor="#4f46e5" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="ntuGradGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
      <linearGradient id="ntuEyeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
    </defs>
    
    {/* Rounded Container */}
    <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#ntuGradPrimary)" />
    
    {/* Graduation Cap Top */}
    <path d="M16 6L5.5 11.2L16 16.4L26.5 11.2L16 6Z" fill="#ffffff" />
    <path d="M22.5 13.8V17.5C22.5 17.5 19.8 20 16 20C12.2 20 9.5 17.5 9.5 17.5V13.8L16 16.9L22.5 13.8Z" fill="#e0e7ff" opacity="0.9" />
    
    {/* Gold Tassel */}
    <path d="M24.5 12.2V17.5" stroke="url(#ntuGradGold)" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="24.5" cy="18.5" r="1.2" fill="url(#ntuGradGold)" />

    {/* AI Eyes / Visor Display */}
    <rect x="7.5" y="21.5" width="17" height="5.5" rx="2.75" fill="#090d16" opacity="0.9" />
    <circle cx="12" cy="24.25" r="1.3" fill="url(#ntuEyeGlow)" />
    <circle cx="20" cy="24.25" r="1.3" fill="url(#ntuEyeGlow)" />
    <path d="M15" stroke="url(#ntuEyeGlow)" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

/**
 * Avatar for Chat Messages and user profiles
 */
export const NtuBotAvatar: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <div className={`relative rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-glow-sm bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 ${className}`}>
    <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
      <NtuEduBotIcon className="w-full h-full p-0.5" />
    </div>
  </div>
);
