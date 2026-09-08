/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Page, Region, ToolType } from './types';
import { Menubar } from './components/Menubar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { EditPanel } from './components/EditPanel';
import { PageStrip } from './components/PageStrip';
import {
  FileText,
  Clock,
  Info,
  ChevronRight,
  Sparkles,
  Download,
  AlertTriangle,
  X,
  HelpCircle,
  CheckCircle,
  HelpCircle as HelpIcon,
  RefreshCw,
  Plus
} from 'lucide-react';

const DEFAULT_PAGES: Page[] = [
  {
    id: 'page_001',
    name: 'Page 1 — Outer Sky',
    imageUrl: null, // Renders ComicPanels page_001
    status: 'queued',
    regions: [],
    isComplete: false
  },
  {
    id: 'page_002',
    name: 'Page 2 — Old Friend Meeting',
    imageUrl: null, // Renders ComicPanels page_002
    status: 'queued',
    regions: [],
    isComplete: false
  },
  {
    id: 'page_003',
    name: 'Page 3 — Episode Start',
    imageUrl: null, // Renders ComicPanels page_003
    status: 'queued',
    regions: [],
    isComplete: false
  }
];

export default function App() {
  const [pages, setPages] = useState<Page[]>(DEFAULT_PAGES);
  const [activePageId, setActivePageId] = useState<string>('page_001');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // Photoshop Visual State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [textPreviewEnabled, setTextPreviewEnabled] = useState<boolean>(true);
  const [compareModeEnabled, setCompareModeEnabled] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Intent Ticker and State machine timer states
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Active dirty edit tracker (to trigger save warnings before page jumps)
  const [hasUnappliedEdits, setHasUnappliedEdits] = useState<boolean>(false);
  const [navTargetId, setNavTargetId] = useState<string | null>(null);

  // Modals overlays
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportProcessing, setExportProcessing] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);

  // Cloud key availability indicator
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  // Appearance Theme choice ('light' by default)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('comic_translator_theme');
    return (saved === 'dark' ? 'dark' : 'light');
  });

  // Apply theme class to HTML node or save to localStorage
  useEffect(() => {
    localStorage.setItem('comic_translator_theme', theme);
  }, [theme]);

  // File uploading references
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timers trigger references
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const translationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active Page Reference Shortcut
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  // 1. Fetch configuration on start
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(!!data.hasApiKey);
      })
      .catch(() => {
        setHasApiKey(false);
      });
  }, []);

  // 2. RUN SLIDING WINDOW CONTROLLER: Preload pages in proximity zone (±3)
  useEffect(() => {
    const activeIndex = pages.findIndex((p) => p.id === activePageId);
    
    pages.forEach((page, index) => {
      // Boundaries preloading window is active within ±3 pages
      const isWithinWindow = Math.abs(index - activeIndex) <= 3;

      if (isWithinWindow && page.status === 'queued') {
        // Trigger preloading (layout analyze + original OCR)
        preloadPage(page.id);
      }
    });
  }, [activePageId, pages]);

  // Preloading step: calls layout analyzer
  const preloadPage = async (pageId: string) => {
    // Transition status to prevent double dispatches
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, status: 'preloaded' } : p))
    );

    try {
      const pageObj = pages.find((p) => p.id === pageId);
      const payload: Record<string, any> = { pageId };

      if (pageObj && pageObj.imageUrl) {
        payload.imageBase64 = pageObj.imageUrl;
      }

      const res = await fetch('/api/analyze-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.regions) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  ...p,
                  status: 'preloaded',
                  regions: data.regions
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error('Failed preloading layout for page:', pageId, err);
    }
  };

  // 3. DRIVE ACTOR INTENT TIMER: 5-second countdown on landing
  useEffect(() => {
    // Clear previous landing timers and countdowns immediately
    clearIntentTimers();

    if (!activePage) return;

    // Reset details selections
    setSelectedRegionId(null);

    // If active page is already ready or done, stop here.
    if (activePage.status === 'ready' || activePage.status === 'done') {
      return;
    }

    // Otherwise, initiate 5s user intent timer
    setCountdown(5);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev !== null && prev > 1) {
          return prev - 1;
        } else {
          // Timer finished!
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          triggerTranslation(activePageId);
          return null;
        }
      });
    }, 1000);

    return () => clearIntentTimers();
  }, [activePageId]);

  const clearIntentTimers = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
      translationTimeoutRef.current = null;
    }
    setCountdown(null);
  };

  // Trigger Translation API call for active page only
  const triggerTranslation = async (pageId: string) => {
    const pageToTranslate = pages.find((p) => p.id === pageId);
    if (!pageToTranslate || pageToTranslate.regions.length === 0) {
      setCountdown(null);
      return;
    }

    // Set page state to TRANSLATING
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, status: 'translating' } : p))
    );
    setIsTranslating(true);

    try {
      const res = await fetch('/api/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: pageId.startsWith('upload_') ? undefined : pageId,
          regions: pageToTranslate.regions
        })
      });
      const data = await res.json();

      if (data.success && data.regions) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId
              ? {
                  ...p,
                  status: 'ready',
                  regions: data.regions
                }
              : p
          )
        );
      } else {
        // Fallback or revert to preloaded
        setPages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, status: 'ready' } : p))
        );
      }
    } catch (err) {
      console.error('Failed translating text sections:', err);
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, status: 'ready' } : p))
      );
    } finally {
      setIsTranslating(false);
      setCountdown(null);
    }
  };

  // Force translate now immediately bypassing 5s landing intent
  const handleForceTranslate = () => {
    clearIntentTimers();
    triggerTranslation(activePageId);
  };

  // 4. LANDING PAGE SELECTION NAVIGATOR (with Dirty Checks)
  const handlePageSelect = (targetId: string) => {
    if (targetId === activePageId) return;

    if (hasUnappliedEdits) {
      // Store target and open Save Warning Confirmation dialogue
      setNavTargetId(targetId);
    } else {
      // Proceed with silent auto-save as per rule:
      // "User on page >= 5s, no active edit or active edit complete -> silent auto-save to JSON on page jump"
      saveWorkspaceChangesSilently(activePageId);
      setActivePageId(targetId);
    }
  };

  // Helper: auto commits active changes silenty and moves page selection
  const saveWorkspaceChangesSilently = (pageId: string) => {
    // If completed/ready, transition overall page status if all elements are marked complete
    setPages((prev) =>
      prev.map((p) => {
        if (p.id === pageId) {
          const allApplied = p.regions.length > 0 && p.regions.every((r) => r.isApplied || r.isHidden);
          return {
            ...p,
            status: allApplied ? 'done' : p.status === 'preloaded' ? 'preloaded' : 'ready'
          };
        }
        return p;
      })
    );
  };

  // Dialogue Choice: User clicks "Apply & Save" on warn alert
  const handleConfirmSaveApply = () => {
    if (!navTargetId || !selectedRegionId) return;

    // Trigger region Apply manually on the active panel content first
    setPages((prev) =>
      prev.map((p) => {
        if (p.id === activePageId) {
          const updatedRegions = p.regions.map((r) =>
            r.id === selectedRegionId ? { ...r, isApplied: true } : r
          );
          const allApplied = updatedRegions.every((r) => r.isApplied || r.isHidden);
          return {
            ...p,
            regions: updatedRegions,
            status: allApplied ? 'done' : 'ready'
          };
        }
        return p;
      })
    );

    // Reset unsaved states and jump
    const nextId = navTargetId;
    setHasUnappliedEdits(false);
    setNavTargetId(null);
    setActivePageId(nextId);
  };

  // Dialogue Choice: User clicks "Discard Edits" on warn alert
  const handleConfirmDiscard = () => {
    if (!navTargetId) return;
    
    // Discards current panels changes and jumps
    const nextId = navTargetId;
    setHasUnappliedEdits(false);
    setNavTargetId(null);
    setActivePageId(nextId);
  };

  // Dialogue Choice: User clicks "Cancel navigation"
  const handleConfirmCancel = () => {
    setNavTargetId(null);
  };

  // 5. REGIONS PROPERTY COMPOSE & EDITS
  const handleRegionSelected = (id: string | null) => {
    if (hasUnappliedEdits) {
      // In-page selection shift while unapplied is active also warns, or auto-applies
      alert('You have unapplied changes on the Selected Region properties. Please check "Apply Changes" first.');
      return;
    }
    setSelectedRegionId(id);
  };

  const handleRegionCreated = (newRegion: Region) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id === activePageId) {
          return {
            ...p,
            regions: [...p.regions, newRegion]
          };
        }
        return p;
      })
    );
    setSelectedRegionId(newRegion.id);
  };

  const handleRegionUpdated = (updatedRegion: Region) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id === activePageId) {
          const updatedList = p.regions.map((r) =>
            r.id === updatedRegion.id ? updatedRegion : r
          );
          return {
            ...p,
            regions: updatedList
          };
        }
        return p;
      })
    );
    setSelectedRegionId(updatedRegion.id);
    setHasUnappliedEdits(false);
  };

  const handleRegionDeleted = (id: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id === activePageId) {
          return {
            ...p,
            regions: p.regions.filter((r) => r.id !== id)
          };
        }
        return p;
      })
    );
    if (selectedRegionId === id) {
      setSelectedRegionId(null);
      setHasUnappliedEdits(false);
    }
  };

  // 6. MANGA IMPORT UPLOAD FLOW
  const handleUploadClicked = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const newPageId = `upload_${Date.now()}`;
      
      const newPage: Page = {
        id: newPageId,
        name: `Page ${pages.length + 1} — Uploaded Comic`,
        imageUrl: base64Url,
        status: 'queued',
        regions: [],
        isComplete: false
      };

      setPages((prev) => [...prev, newPage]);
      handlePageSelect(newPageId); // Navigates automatically to uploaded page
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Clean input
  };

  // 7. CORE CHAPTER RESET FLOW
  const handleResetChapter = () => {
    const confirmReset = window.confirm(
      'Are you sure you want to reset the entire chapter workspace? This removes all manual boundary boxes and changes.'
    );
    if (confirmReset) {
      clearIntentTimers();
      setPages(DEFAULT_PAGES.map(p => ({ ...p, status: 'queued', regions: [], isComplete: false })));
      setActivePageId('page_001');
      setSelectedRegionId(null);
      setHasUnappliedEdits(false);
    }
  };

  // 8. COMPILE AND EXPORT (LAMA SIMULATOR)
  const handleExportClicked = () => {
    setShowExportModal(true);
    setExportProcessing(true);
    setExportComplete(false);

    // Simulate 1.5s content-aware erase & text render
    setTimeout(() => {
      setExportProcessing(false);
      setExportComplete(true);
    }, 1800);
  };

  // 9. TRIGGER DOWNLOAD AS IMAGE/PDF
  const triggerImageDownload = () => {
    // Generate simple simulated canvas download
    const link = document.createElement('a');
    link.download = `comic_translated_${activePageId}.png`;
    // Create simple data URL representations or download an example
    link.href = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="100%" height="100%" fill="%23f5f5f4"/><text x="50" y="100" font-family="sans-serif" font-size="20" fill="%231c1917">COMIC TRANSLATION OUT</text></svg>';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('Simulating LaMa Inpainting Layer Merge: Compiled translated page JPG successfully exported!');
  };

  return (
    <div
      id="comic-translator-root"
      className={`h-screen w-screen font-sans flex flex-col select-none overflow-hidden antialiased transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-stone-950 text-stone-250'
          : 'bg-[#F3F4F6] text-gray-800'
      }`}
    >
      
      {/* Off-canvas layout triggers File upload */}
      <input
        id="import-image-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* MENUBAR HEADER */}
      <Menubar
        onResetChapter={handleResetChapter}
        onUploadClicked={handleUploadClicked}
        onExportClicked={handleExportClicked}
        onHelpClicked={() => setShowHelpModal(true)}
        hasApiKey={hasApiKey}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* WORKSPACE CONTENT BODY */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* PHOTOSHOP-STYLE LEFT TOOLBAR */}
        <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          textPreviewEnabled={textPreviewEnabled}
          setTextPreviewEnabled={setTextPreviewEnabled}
          compareModeEnabled={compareModeEnabled}
          setCompareModeEnabled={setCompareModeEnabled}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          theme={theme}
        />

        {/* WORKSPACE CENTRAL CANVAS */}
        <Canvas
          activePageId={activePageId}
          customImageUrl={activePage.imageUrl}
          regions={activePage.regions}
          selectedRegionId={selectedRegionId}
          onRegionSelected={handleRegionSelected}
          onRegionCreated={handleRegionCreated}
          activeTool={activeTool}
          textPreviewEnabled={textPreviewEnabled}
          compareModeEnabled={compareModeEnabled}
          zoomLevel={zoomLevel}
        />

        {/* PROPERTIES EDITOR PANEL */}
        <EditPanel
          regions={activePage.regions}
          selectedRegionId={selectedRegionId}
          onRegionSelected={handleRegionSelected}
          onRegionUpdated={handleRegionUpdated}
          onRegionDeleted={handleRegionDeleted}
          onActiveEditChanged={setHasUnappliedEdits}
          theme={theme}
        />

      </div>

      {/* WORKSPACE NAVIGATOR & FOOTER */}
      <PageStrip
        pages={pages}
        currentPageId={activePageId}
        onPageSelected={handlePageSelect}
        countdown={countdown}
        isTranslating={isTranslating}
        onManualTriggerTranslate={handleForceTranslate}
        onUploadClicked={handleUploadClicked}
        theme={theme}
      />

      {/* POPUP A: UNSAVED CHANGES PAGE JUMP GUARD */}
      {navTargetId !== null && (
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4">
          <div className={`border rounded-xl w-full max-w-md p-6 shadow-2xl relative transition-colors duration-200 ${
            theme === 'dark' ? 'bg-stone-900 border-stone-800 text-stone-300' : 'bg-white border-gray-200 text-gray-700'
          }`}>
            <div className="flex items-start space-x-3">
              <div className={`p-2.5 rounded-lg ${
                theme === 'dark' ? 'bg-amber-950/40 text-amber-500' : 'bg-amber-50 text-amber-600'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-stone-100' : 'text-gray-800'}`}>Unapplied Changes Alert</h3>
                <p className={`text-xs mt-2 leading-relaxed ${theme === 'dark' ? 'text-stone-400' : 'text-gray-500'}`}>
                  You are attempting to jump pages with modified translation fields in progress. As part of our cooperative safety workflow checks, you must decide how to handle these parameters first:
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col space-y-2">
              <button
                id="modal-apply-btn"
                onClick={handleConfirmSaveApply}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                Apply changes to Canvas & Proceed
              </button>
              
              <button
                id="modal-discard-btn"
                onClick={handleConfirmDiscard}
                className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs border transition-colors cursor-pointer shadow-sm ${
                  theme === 'dark'
                    ? 'bg-stone-850 hover:bg-stone-800 border-stone-750 text-stone-200'
                    : 'bg-white hover:bg-gray-55 text-gray-700 border-gray-205'
                }`}
              >
                Discard changes & Proceed
              </button>

              <button
                id="modal-cancel-btn"
                onClick={handleConfirmCancel}
                className={`w-full py-2 py-1.5 text-[11px] font-mono transition-colors mt-1 ${
                  theme === 'dark' ? 'text-stone-550 hover:text-stone-400' : 'text-gray-400 hover:text-gray-650'
                }`}
              >
                [Cancel Navigate]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP B: WORKFLOW HELP MANUAL OVERLAY */}
      {showHelpModal && (
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center z-[90] p-4">
          <div className={`border rounded-xl w-full max-w-2xl max-h-[85%] overflow-hidden flex flex-col shadow-2xl transition-colors duration-200 ${
            theme === 'dark' ? 'bg-stone-900 border-stone-800 text-stone-300' : 'bg-white border-gray-200 text-gray-700'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              theme === 'dark' ? 'bg-stone-950 border-stone-850' : 'bg-gray-55 border-gray-100'
            }`}>
              <div className="flex items-center space-x-2">
                <HelpIcon className="text-blue-500" size={18} />
                <h2 className={`text-xs font-mono font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-stone-200' : 'text-gray-800'}`}>Cooperative Workflow Guidelines</h2>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className={`p-1 ${theme === 'dark' ? 'text-stone-550 hover:text-stone-300' : 'text-gray-400 hover:text-gray-650'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className={`p-6 overflow-y-auto space-y-5 text-xs leading-relaxed max-h-160 custom-scrollbar ${
              theme === 'dark' ? 'bg-stone-900 text-stone-305' : 'bg-white text-gray-600'
            }`}>
              
              <div>
                <h3 className="font-bold text-blue-550 text-xs mb-2 uppercase tracking-wide">1. Central Human-in-the-Loop Principle</h3>
                <p className={theme === 'dark' ? 'text-stone-400' : 'text-gray-600'}>
                  To protect translation accuracy and design layout aesthetics, <strong>the machine never auto-applies text overlay content to the active comic canvas on its own.</strong> The layout neural networks compile detection regions, and server-side model pipelines output translated English speech, but content ONLY registers on export after the User approves it.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-blue-550 text-xs mb-2 uppercase tracking-wide">2. Region Taxonomy & Dynamic OCR Routing</h3>
                <table className={`w-full text-left font-mono rounded-lg overflow-hidden text-[10.5px] border ${
                  theme === 'dark' ? 'border-stone-800 bg-stone-950/40 text-stone-400' : 'border-gray-200 bg-white text-gray-500'
                }`}>
                  <thead>
                    <tr className={`border-b ${theme === 'dark' ? 'bg-stone-950 border-stone-800 text-stone-300' : 'bg-gray-55 border-gray-200 text-gray-650 font-bold'}`}>
                      <th className="p-2">Type</th>
                      <th className="p-2">Intended Item</th>
                      <th className="p-2">Selected Router</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'dark' ? 'divide-stone-850' : 'divide-gray-150'}`}>
                    <tr>
                      <td className="p-2 font-bold text-blue-500">bubble</td>
                      <td className="p-2">Speech/thoughts with visible shapes</td>
                      <td className="p-2 text-gray-400">manga-ocr</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-indigo-505">narrator</td>
                      <td className="p-2">Rectangular caption bounding boxes</td>
                      <td className="p-2 text-gray-400">easyOCR (General text)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-amber-500">sfx</td>
                      <td className="p-2">Stylized sound effects over illustrations</td>
                      <td className="p-2 text-gray-400">PaddleOCR / Gemini Vision</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-teal-500">author_note</td>
                      <td className="p-2">Marginal handwritten note guides</td>
                      <td className="p-2 text-gray-400">TrOCR (Handwriting)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-rose-500">title</td>
                      <td className="p-2">Stylized chapter title banner / logo</td>
                      <td className="p-2 text-gray-400">Bypasses OCR (Manual Input)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="font-bold text-blue-550 text-xs mb-2 uppercase tracking-wide">3. sliding window memory discipline</h3>
                <p className={theme === 'dark' ? 'text-stone-400' : 'text-gray-600'}>
                  To safeguard system memory footprint when compiling large chapters (e.g. 100+ pages), the workspace uses a strict sliding configuration:
                </p>
                <ul className={`list-disc pl-5 space-y-1 mt-2 ${theme === 'dark' ? 'text-stone-500' : 'text-gray-500'}`}>
                  <li><strong>Active zone:</strong> Full detection + active client editing inside RAM.</li>
                  <li><strong>Preload zone (active ± 3 pages):</strong> Layout analysis and raw transcriptions are initiated and loaded from server automatically.</li>
                  <li><strong>Cached zone:</strong> Unused far pages are committed to local JSON, releasing heavy comic image assets from client memory.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-blue-550 text-xs mb-2 uppercase tracking-wide">4. save triggers</h3>
                <ul className={`list-disc pl-5 space-y-1 ${theme === 'dark' ? 'text-stone-500' : 'text-gray-500'}`}>
                  <li>If staying on a newly opened comic page <span className="underline">less than 5 seconds</span> and shifting selection: page resets with no cache logs, preventing wasteful translation API quota usage.</li>
                  <li>If staying <span className="underline text-blue-500">greater than 5 seconds</span>, original OCR triggers background translation API. If navigating away after translation exists, page state commits silenty without popping alerts.</li>
                  <li>If the user has modified variables in the properties panel but has not clicked <strong>Apply Changes</strong>, clicking another page triggers the save warning dialog.</li>
                </ul>
              </div>

            </div>

            <div className={`px-6 py-4 border-t text-right ${theme === 'dark' ? 'bg-stone-950 border-stone-850' : 'bg-gray-55 border-gray-100'}`}>
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP C: LAMA INPAINT & PILLOW COMPILE DIALOGUE */}
      {showExportModal && (
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className={`border rounded-xl w-full max-w-xl shadow-2xl overflow-hidden transition-colors duration-205 ${
            theme === 'dark' ? 'bg-stone-900 border-stone-800 text-stone-350' : 'bg-white border-gray-200 text-gray-750'
          }`}>
            
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              theme === 'dark' ? 'bg-stone-950 border-stone-850' : 'bg-gray-55 border-gray-100'
            }`}>
              <h2 className={`text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'dark' ? 'text-stone-200' : 'text-gray-800'
              }`}>
                <RefreshCw size={14} className={exportProcessing ? 'animate-spin text-blue-500' : 'text-emerald-500'} />
                CHAPTER COMPILATION EXPORT PIPELINE
              </h2>
              {!exportProcessing && (
                <button
                  onClick={() => setShowExportModal(false)}
                  className={`p-1 ${theme === 'dark' ? 'text-stone-550 hover:text-stone-300' : 'text-gray-400 hover:text-gray-650'}`}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className={`p-6 text-center ${theme === 'dark' ? 'bg-stone-900' : 'bg-white'}`}>
              {exportProcessing ? (
                <div className="py-8 space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-stone-200' : 'text-gray-805'}`}>Compiling Non-Destructive layers...</h3>
                  <div className={`text-xs font-mono space-y-1.5 max-w-xs mx-auto text-left p-3 rounded-lg border ${
                    theme === 'dark' ? 'bg-stone-950 border-stone-850 text-stone-400' : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>
                    <p className="text-emerald-500 font-semibold">✔ 1. Collecting Approved Regions [Keep/Hide]</p>
                    <p className="text-blue-500 font-semibold">⟳ 2. Executing LaMa Inpainting over mask zones...</p>
                    <p className={theme === 'dark' ? 'text-stone-600' : 'text-gray-400'}>· 3. Spawning Pillow TTF font compiler...</p>
                    <p className={theme === 'dark' ? 'text-stone-600' : 'text-gray-400'}>· 4. Exporting PNG raster data...</p>
                  </div>
                </div>
              ) : (
                <div className="py-4 space-y-5">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 border ${
                    theme === 'dark' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                  }`}>
                    <CheckCircle size={32} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-stone-250' : 'text-gray-800'}`}>LaMa Inpaint Compile Successful</h3>
                    <p className={`text-xs mt-1.5 max-w-md mx-auto leading-relaxed ${theme === 'dark' ? 'text-stone-405' : 'text-gray-500 font-semibold'}`}>
                      All approved text bubble coordinates have been content-erased (inpainted) on the original comic illustration. Pillow fonts have been rasterized as high-contrast layer vectors.
                    </p>
                  </div>

                  <div className={`p-3.5 rounded-lg border font-mono text-[11px] text-left max-w-sm mx-auto space-y-1 ${
                    theme === 'dark' ? 'bg-stone-950 border-stone-850 text-stone-400' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    <p><span className={theme === 'dark' ? 'text-stone-550' : 'text-gray-400'}>Active page:</span> {activePage.name}</p>
                    <p><span className={theme === 'dark' ? 'text-stone-555' : 'text-gray-400'}>Inpainted elements:</span> {activePage.regions.filter(r => r.isApplied).length} regions</p>
                    <p><span className={theme === 'dark' ? 'text-stone-555' : 'text-gray-400'}>Hidden / Erased elements:</span> {activePage.regions.filter(r => r.isHidden).length} regions</p>
                    <p><span className={theme === 'dark' ? 'text-stone-555' : 'text-gray-400'}>Render Resolution:</span> Vector Rasterized (Lossless aspect)</p>
                  </div>

                  <div className="flex space-x-3 max-w-sm mx-auto pt-2">
                    <button
                      onClick={() => setShowExportModal(false)}
                      className={`flex-1 py-2 px-3 border rounded-lg text-xs font-semibold cursor-pointer ${
                        theme === 'dark' ? 'border-stone-800 hover:bg-stone-850 text-stone-400' : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      Back to canvas
                    </button>
                    <button
                      onClick={triggerImageDownload}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download PNG</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
