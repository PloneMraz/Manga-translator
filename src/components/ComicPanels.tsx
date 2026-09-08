/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ComicPanelsProps {
  pageId: string;
}

export const ComicPanels: React.FC<ComicPanelsProps> = ({ pageId }) => {
  if (pageId === 'page_001') {
    return (
      <div id="comic-panels-page1" className="relative w-full h-full bg-stone-100 p-4 border border-stone-300 rounded shadow-inner select-none overflow-hidden" style={{ aspectRatio: '3/4' }}>
        {/* Speed line background for flyer panel */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, #000 0deg 3deg, transparent 3deg 20deg)' }}></div>
        
        {/* Panel 1 (Top Left) */}
        <div className="absolute top-4 left-4 right-1/2 bottom-1/2 border-2 border-stone-800 bg-white shadow overflow-hidden p-2 flex flex-col justify-between">
          <div className="relative w-full h-full flex flex-col justify-center items-center">
            {/* Sketch of hero flying */}
            <svg viewBox="0 0 100 100" className="w-24 h-24 text-stone-300 pointer-events-none">
              <path d="M10 80 Q 50 20, 90 40" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="3,3" />
              <circle cx="90" cy="40" r="4" fill="currentColor" />
              <path d="M70 42 L88 38 L84 48" stroke="currentColor" strokeWidth="2" fill="none" />
              {/* Cloud sketch */}
              <path d="M20 30 Q25 25 35 30 T50 30" stroke="#e0e0e0" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="text-[10px] font-mono text-stone-400 absolute bottom-1 right-1">PANEL 1</div>
          </div>
        </div>

        {/* Panel 2 (Top Right) */}
        <div className="absolute top-4 left-[53%] right-4 bottom-[55%] border-2 border-stone-800 bg-white shadow overflow-hidden p-2">
          {/* Action speed lines representation */}
          <div className="absolute inset-0 opacity-15" style={{ background: 'linear-gradient(135deg, transparent 40%, #000 45%, #000 55%, transparent 60%)', backgroundSize: '10px 10px' }}></div>
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <svg viewBox="0 0 100 100" className="w-16 h-16 text-stone-400">
              <path d="M20 50 L80 50 M50 20 L50 80" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
              <polygon points="50,40 60,60 40,60" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-[9px] font-mono text-stone-400 absolute bottom-0">PANEL 2</span>
          </div>
        </div>

        {/* Panel 3 (Bottom Panel) */}
        <div className="absolute top-[48%] left-4 right-4 bottom-4 border-2 border-stone-800 bg-white shadow overflow-hidden p-4">
          <div className="w-full h-full flex flex-row justify-between items-end relative">
            {/* Outline of Japanese highrise buildings */}
            <div className="flex items-end space-x-2 w-full h-full opacity-45 pointer-events-none">
              <div className="w-10 h-32 bg-stone-100 border border-stone-300"></div>
              <div className="w-14 h-40 bg-stone-200 border border-stone-300 relative">
                <div className="absolute top-2 left-2 right-2 bottom-2 grid grid-cols-2 gap-1">
                  <div className="bg-white/70 h-2"></div>
                  <div className="bg-white/70 h-2"></div>
                  <div className="bg-white/70 h-2"></div>
                  <div className="bg-white/70 h-2"></div>
                </div>
              </div>
              <div className="w-12 h-24 bg-stone-100 border border-stone-300"></div>
              <div className="w-16 h-36 bg-stone-150 border border-stone-300"></div>
            </div>
            
            <div className="absolute top-2 left-2 text-[10px] font-mono text-stone-400">PANEL 3: CITY ARRIVAL</div>
          </div>
        </div>
      </div>
    );
  }

  if (pageId === 'page_002') {
    return (
      <div id="comic-panels-page2" className="relative w-full h-full bg-stone-100 p-4 border border-stone-300 rounded shadow-inner select-none overflow-hidden" style={{ aspectRatio: '3/4' }}>
        {/* Panel 1 (Top Full-width) */}
        <div className="absolute top-4 left-4 right-4 bottom-1/2 border-2 border-stone-800 bg-white shadow overflow-hidden p-4">
          <div className="absolute right-4 top-2 opacity-10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>
          <div className="w-full h-full flex justify-around items-center relative">
            {/* Silhouettes of two friends */}
            <div className="flex space-x-12 items-end">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-stone-800 relative">
                  <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-4 h-4 bg-stone-800 rotate-45"></div>
                </div>
                <span className="text-[9px] text-stone-500 mt-3">Kenji</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-stone-300 relative">
                  <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-3 h-3 bg-stone-300 rotate-45"></div>
                </div>
                <span className="text-[9px] text-stone-500 mt-2">Protagonist</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-stone-400 absolute left-2 top-0">PANEL 1: REUNION</div>
          </div>
        </div>

        {/* Panel 2 (Bottom Left) */}
        <div className="absolute top-[53%] left-4 right-1/2 bottom-4 border-2 border-stone-800 bg-white shadow overflow-hidden p-2 flex flex-col justify-between">
          <div className="w-full h-full flex flex-col justify-center items-center relative">
            <svg viewBox="0 0 100 100" className="w-16 h-16 text-stone-300">
              <path d="M30 70 A20 20 0 0 1 70 70" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="40" cy="50" r="3" fill="currentColor" />
              <circle cx="60" cy="50" r="3" fill="currentColor" />
            </svg>
            <div className="text-[9px] font-mono text-stone-400 absolute bottom-1 left-1">PANEL 2</div>
          </div>
        </div>

        {/* Panel 3 (Bottom Right) */}
        <div className="absolute top-[53%] left-[53%] right-4 bottom-4 border-2 border-stone-800 bg-white shadow overflow-hidden p-2 flex flex-col justify-between">
          <div className="w-full h-full flex flex-col justify-center items-center relative">
            <div className="text-3xl font-extrabold text-stone-200 pointer-events-none select-none tracking-widest uppercase">CLOSEUP</div>
            <div className="text-[9px] font-mono text-stone-400 absolute bottom-1 right-1">PANEL 3</div>
          </div>
        </div>
      </div>
    );
  }

  if (pageId === 'page_003') {
    return (
      <div id="comic-panels-page3" className="relative w-full h-full bg-stone-100 p-4 border border-stone-300 rounded shadow-inner select-none overflow-hidden" style={{ aspectRatio: '3/4' }}>
        {/* Panel 1 (Top Column Left) */}
        <div className="absolute top-4 left-4 right-1/2 bottom-[45%] border-2 border-stone-800 bg-white shadow overflow-hidden p-2">
          <div className="w-full h-full flex flex-col justify-between relative">
            <div className="text-[9px] font-mono text-stone-400">PANEL 1: CONFUSED PATHS</div>
            {/* Path routing vector drawing */}
            <svg viewBox="0 0 100 100" className="w-20 h-20 text-stone-200 self-center">
              <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2"/>
              <path d="M20 20 L20 80 L50 80 L50 50 L80 50" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="80" cy="50" r="3" fill="#ef4444" />
            </svg>
          </div>
        </div>

        {/* Panel 2 (Top Column Right) */}
        <div className="absolute top-4 left-[53%] right-4 bottom-[45%] border-2 border-stone-800 bg-white shadow overflow-hidden p-2">
          <div className="w-full h-full flex flex-col justify-center items-center relative">
            {/* GPS icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-stone-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-[9px] font-mono text-stone-400 absolute bottom-1 right-1">PANEL 2</span>
          </div>
        </div>

        {/* Panel 3 (Bottom Full Horizontal) */}
        <div className="absolute top-[58%] left-4 right-4 bottom-4 border-2 border-stone-800 bg-white shadow overflow-hidden p-4">
          <div className="w-full h-full flex flex-col justify-between relative">
            {/* Chapter title banner background details */}
            <div className="absolute inset-0 bg-stone-50 border border-stone-200 rounded flex flex-col justify-center items-center opacity-65 p-2" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '8px 8px' }}>
              <div className="text-stone-300 font-serif text-sm tracking-[0.2em] font-extrabold uppercase">EPISODE ONE</div>
            </div>
            
            <div className="text-[9px] font-mono text-stone-400 z-10">PANEL 3: TITLE CARD</div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for custom uploaded files
  return (
    <div id="comic-panels-custom shadow-inner" className="relative w-full h-full bg-stone-300 rounded flex items-center justify-center overflow-hidden" style={{ aspectRatio: '3/4' }}>
      <div className="absolute inset-0 bg-radial-gradient flex flex-col items-center justify-center p-6 text-center select-none text-stone-400 opacity-60 pointer-events-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-24 h-24 text-stone-400 mb-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
        </svg>
        <div className="text-[14px] font-medium tracking-wide">CUSTOM PAGE LOADED</div>
        <div className="text-[11px] font-mono text-stone-400 mt-1">Non-Destructive Interactive Edit Layer Engaged</div>
      </div>
    </div>
  );
};
