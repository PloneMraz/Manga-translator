/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Page } from '../types';
import {
  FileText,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface PageStripProps {
  pages: Page[];
  currentPageId: string;
  onPageSelected: (id: string) => void;
  countdown: number | null; // NULL represents triggered or inactive, integer represents seconds remaining
  isTranslating: boolean;
  onManualTriggerTranslate: () => void;
  onUploadClicked: () => void;
  theme: 'light' | 'dark';
}

export const PageStrip: React.FC<PageStripProps> = ({
  pages,
  currentPageId,
  onPageSelected,
  countdown,
  isTranslating,
  onManualTriggerTranslate,
  onUploadClicked,
  theme,
}) => {
  const currentPageIndex = pages.findIndex((p) => p.id === currentPageId);

  // Status badges definitions
  const getStatusBadgeAndClass = (status: Page['status'], currTheme: 'light' | 'dark') => {
    switch (status) {
      case 'done':
        return { text: '✓ DONE', colorClass: currTheme === 'dark' ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400 font-bold' : 'bg-emerald-50 border-emerald-250 text-emerald-605 font-bold' };
      case 'ready':
        return { text: '● READY', colorClass: currTheme === 'dark' ? 'bg-blue-950/20 border-blue-900/40 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600' };
      case 'translating':
        return { text: '⟳ TRANSLATING', colorClass: currTheme === 'dark' ? 'bg-amber-955/20 border-amber-900/40 text-amber-400 animate-pulse' : 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse' };
      case 'preloaded':
        return { text: '· PRELOADED', colorClass: currTheme === 'dark' ? 'bg-purple-955/20 border-purple-900/40 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-600' };
      default: // queued
        return { text: '· QUEUED', colorClass: currTheme === 'dark' ? 'bg-stone-950 border-stone-800 text-stone-500' : 'bg-gray-50 border-gray-200 text-gray-400' };
    }
  };

  const activePage = pages[currentPageIndex];

  // Calculated overall metrics
  const totalRegions = pages.reduce((acc, p) => acc + p.regions.length, 0);
  const completedRegions = pages.reduce(
    (acc, p) => acc + p.regions.filter((r) => r.isApplied).length,
    0
  );

  return (
    <div
      id="footer-workspace-navigator"
      className={`h-[120px] border-t flex flex-col justify-between flex-shrink-0 select-none transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-stone-900 border-stone-850'
          : 'bg-white border-t border-gray-200'
      }`}
    >
      
      {/* LINE A: PAGE STRIP NAIL MATRIX CARDS */}
      <div className={`flex-1 flex items-center px-4 justify-between border-b py-1.5 ${
        theme === 'dark' ? 'border-stone-850' : 'border-gray-100'
      }`}>
        
        {/* Previous page handle */}
        <button
          id="prev-page-btn"
          disabled={currentPageIndex <= 0}
          onClick={() => onPageSelected(pages[currentPageIndex - 1].id)}
          className={`p-1.5 rounded-md disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer ${
            theme === 'dark'
              ? 'hover:bg-stone-800 text-stone-500 hover:text-stone-300'
              : 'hover:bg-gray-55 text-gray-400 hover:text-gray-800'
          }`}
          title="Previous Page"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Scrolling thumbnail list */}
        <div id="page-strip-items" className="flex-1 flex items-center justify-center space-x-3 overflow-x-auto px-4">
          {pages.map((p, index) => {
            const isSelected = p.id === currentPageId;
            const badge = getStatusBadgeAndClass(p.status, theme);
            
            // Calculate progress fraction
            const appliedCount = p.regions.filter(r => r.isApplied).length;
            const totalCount = p.regions.length;

            return (
              <div
                key={p.id}
                id={`page-thumbnail-${p.id}`}
                onClick={() => onPageSelected(p.id)}
                className={`relative group px-4 py-2 rounded-lg cursor-pointer flex flex-col items-start min-w-[130px] border transition-all ${
                  isSelected
                    ? theme === 'dark'
                      ? 'border-blue-500 ring-2 ring-blue-950/50 shadow-sm bg-stone-900'
                      : 'border-blue-500 ring-2 ring-blue-100 shadow-sm bg-white'
                    : theme === 'dark'
                      ? 'bg-stone-950/40 border-stone-850 hover:bg-stone-800 hover:border-stone-750'
                      : 'bg-gray-50/50 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-1.5 min-w-0 w-full justify-between">
                  <span className={`text-[10px] font-mono tracking-tight truncate ${
                    isSelected
                      ? 'text-blue-505 font-bold'
                      : theme === 'dark'
                        ? 'text-stone-400'
                        : 'text-gray-500'
                  }`}>
                    Page {index + 1}
                  </span>
                  <span className={`text-[9px] font-mono ${
                    theme === 'dark' ? 'text-stone-550' : 'text-gray-400'
                  }`}>
                    {appliedCount}/{totalCount} reg
                  </span>
                </div>

                <div className="flex items-center justify-between w-full mt-1.5 font-sans">
                  {/* Status Pills */}
                  <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${badge.colorClass}`}>
                    {badge.text}
                  </span>
                  
                  {/* Miniature progress meter bar */}
                  <div className={`w-10 h-1 rounded-full overflow-hidden ${
                    theme === 'dark' ? 'bg-stone-850' : 'bg-gray-100'
                  }`}>
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: totalCount > 0 ? `${(appliedCount / totalCount) * 100}%` : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Special Upload quick trigger button card */}
          <button
            id="page-strip-add-new"
            onClick={onUploadClicked}
            className={`px-3.5 py-2 rounded-lg cursor-pointer font-medium text-[10.5px] flex items-center space-x-2 shrink-0 select-none border border-dashed transition-all ${
              theme === 'dark'
                ? 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-850 hover:border-blue-500/50'
                : 'bg-white border-dashed border-gray-300 text-gray-500 hover:text-gray-805 hover:bg-gray-50 hover:border-blue-300'
            }`}
          >
            <FolderOpen size={14} className="text-blue-500" />
            <span>Import Page</span>
          </button>
        </div>

        {/* Next page handle */}
        <button
          id="next-page-btn"
          disabled={currentPageIndex >= pages.length - 1}
          onClick={() => onPageSelected(pages[currentPageIndex + 1].id)}
          className={`p-1.5 rounded-md disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer ${
            theme === 'dark'
              ? 'hover:bg-stone-800 text-stone-500 hover:text-stone-300'
              : 'hover:bg-gray-55 text-gray-405 hover:text-gray-800'
          }`}
          title="Next Page"
        >
          <ArrowRight size={16} />
        </button>

      </div>

      {/* LINE B: DEEP WORKSPACE STATUSBAR */}
      <div
        id="footer-statusbar"
        className={`h-[34px] px-4 text-[10.5px] font-mono flex items-center justify-between border-t transition-colors duration-200 ${
          theme === 'dark'
            ? 'bg-stone-950 text-stone-500 border-stone-850'
            : 'bg-gray-50 text-gray-500 border-gray-100'
        }`}
      >
        
        {/* OCR / API connection status summary */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-1 border border-transparent">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
            <span className={theme === 'dark' ? 'text-stone-400' : 'text-gray-650'}>Active Engine:</span>
            <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
              theme === 'dark' ? 'bg-stone-850 text-blue-450' : 'bg-gray-200/50 text-blue-650'
            }`}>PaddleOCR layout v4</span>
          </div>
          <span className={theme === 'dark' ? 'text-stone-800' : 'text-gray-200'}>|</span>
          <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-stone-500' : 'text-gray-505'}`}>
            <Clock size={11} className={theme === 'dark' ? 'text-stone-600' : 'text-gray-400'} />
            RAM: Sliding Window active [Current Page active, ± 3 Preloaded]
          </span>
        </div>

        {/* ACTIVE INTENT TIMER DISPATCH INDICATOR */}
        <div id="intent-timer-status" className="flex items-center space-x-3">
          {isTranslating ? (
            <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded border ${
              theme === 'dark' ? 'text-amber-400 bg-amber-955/20 border-amber-900/40' : 'text-amber-655 bg-amber-50 border-amber-200'
            }`}>
              <RefreshCw size={11} className="animate-spin" />
              <span>TRANSLATION API DISPATCHED VIA GEMINI...</span>
            </div>
          ) : countdown !== null && countdown > 0 ? (
            <div className={`flex items-center space-x-2 px-2 py-0.5 rounded border ${
              theme === 'dark' ? 'text-purple-400 bg-purple-955/20 border-purple-900/40' : 'text-purple-650 bg-purple-50 border-purple-200'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span>USER INTENT DETECTED: AUTO-TRANSLATING IN {countdown}S</span>
              <button
                id="manual-skip-countdown-btn"
                onClick={onManualTriggerTranslate}
                className={`underline pl-1 font-bold text-[9px] cursor-pointer ${
                  theme === 'dark' ? 'text-purple-400 hover:text-purple-300' : 'text-purple-650 hover:text-purple-800'
                }`}
                title="Trigger Translate manually immediately bypassing 5s landing intent"
              >
                [Force Stream Now]
              </button>
            </div>
          ) : activePage?.status === 'ready' || activePage?.status === 'done' ? (
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${
              theme === 'dark' ? 'bg-emerald-955/20 text-emerald-405 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-250'
            }`}>
              <Sparkles size={11} />
              <span>Full Pipeline complete: translations ready for edit.</span>
            </div>
          ) : (
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded border ${
              theme === 'dark' ? 'bg-stone-900 border-stone-850 text-stone-500' : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
              <Zap size={10} className={theme === 'dark' ? 'text-stone-600' : 'text-gray-400'} />
              <span>Awaiting intent loop (stay 5s to trigger API translate)</span>
            </div>
          )}

          <span className={theme === 'dark' ? 'text-stone-800' : 'text-gray-200'}>|</span>
          
          {/* Total Chapter metrics progress */}
          <span className={`font-sans tracking-tight ${theme === 'dark' ? 'text-stone-400' : 'text-gray-500'}`}>
            Overall: <strong className={theme === 'dark' ? 'text-stone-200' : 'text-gray-700'}>{completedRegions}</strong> of <strong className={theme === 'dark' ? 'text-stone-300' : 'text-gray-750'}>{totalRegions}</strong> regions applied
          </span>
        </div>

      </div>

    </div>
  );
};
