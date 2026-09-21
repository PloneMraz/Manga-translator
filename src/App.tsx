/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page, Region, ToolType } from './types';
import { createEngine, EngineError, findProvider, type EngineProgress } from './engine';
import {
  openOutputSession,
  outputFolderName,
  pageFileName,
  pickOutputRoot,
  renderTranslatedPage,
  supportsDirectoryOutput,
  type DirectoryHandle,
  type OutputSession,
} from './output';
import { toRegions } from './lib/regions';
import { loadSettings, saveSettings, type AppSettings } from './settings';
import { SettingsModal } from './components/SettingsModal';
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

/** A run of work is one upload; more than this belongs in separate runs. */
const MAX_PAGES = 100;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

/** Pixel size, so engines and the renderer work at the page's real scale. */
function measure(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Not a decodable image.'));
    image.src = dataUrl;
  });
}

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string>('');
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

  // Which engine translates, and between which languages. Never hardcoded.
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [engineStatus, setEngineStatus] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);

  // Where approved pages are written. One upload is one session, one folder.
  const outputRootRef = useRef<DirectoryHandle | null>(null);
  const sessionRef = useRef<OutputSession | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedTo, setExportedTo] = useState<string | null>(null);

  const engine = useMemo(() => createEngine(settings.engine), [settings.engine]);
  useEffect(() => () => engine.dispose(), [engine]);

  const langs = { source: settings.sourceLang, target: settings.targetLang };
  const engineReady =
    settings.engine.kind === 'offline' || Boolean(settings.engine.apiKey?.trim());
  const engineLabel =
    settings.engine.kind === 'offline'
      ? 'On this device'
      : findProvider(settings.engine.providerId)?.label ?? 'AI';

  const reportProgress = (progress: EngineProgress) => setEngineStatus(progress.message);

  const describeFailure = (error: unknown): string =>
    error instanceof EngineError ? error.message : error instanceof Error ? error.message : String(error);

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

  // Preloading step: ask the engine to find, read and translate the page.
  const preloadPage = async (pageId: string) => {
    // Move the status first so a second pass cannot dispatch the same page.
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, status: 'preloaded' } : p)));
    setEngineError(null);

    const pageObj = pages.find((p) => p.id === pageId);
    if (!pageObj?.imageUrl) return;

    try {
      const found = await engine.detectAndTranslate(
        { dataUrl: pageObj.imageUrl, width: pageObj.width ?? 0, height: pageObj.height ?? 0 },
        langs,
        reportProgress,
      );
      // Engines report what they found; the presentation fields Region needs
      // are filled in here, and nothing is marked applied without the user.
      const regions = toRegions(found);
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, status: 'preloaded', regions } : p)),
      );
    } catch (error) {
      // No invented regions. The page stays empty and the failure is shown.
      //
      // The status must NOT go back to 'queued': the preload effect re-runs on
      // every change to `pages`, so a queued page would be retried forever,
      // re-rendering under the user's hands. 'preloaded' means "we tried";
      // the page can still be worked on by hand, and Translate Now retries.
      setEngineError(describeFailure(error));
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, status: 'preloaded' } : p)));
    } finally {
      setEngineStatus(null);
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

  // Re-translate text already read: after an edit, or a change of target
  // language. Detection and reading are not repeated.
  const triggerTranslation = async (pageId: string) => {
    const pageToTranslate = pages.find((p) => p.id === pageId);
    if (!pageToTranslate || pageToTranslate.regions.length === 0) {
      setCountdown(null);
      return;
    }

    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, status: 'translating' } : p)));
    setIsTranslating(true);
    setEngineError(null);

    try {
      const translations = await engine.translateTexts(
        pageToTranslate.regions.map((r) => ({ id: r.id, type: r.type, text: r.ocrText })),
        langs,
        reportProgress,
      );
      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                status: 'ready',
                regions: p.regions.map((r) => ({
                  ...r,
                  // A region the engine skipped keeps whatever it had; it is
                  // never filled with a stand-in.
                  translatedText: translations[r.id] ?? r.translatedText,
                })),
              }
            : p,
        ),
      );
    } catch (error) {
      setEngineError(describeFailure(error));
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, status: 'preloaded' } : p)));
    } finally {
      setIsTranslating(false);
      setCountdown(null);
      setEngineStatus(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = ''; // let the same file be chosen again later
    if (chosen.length === 0) return;

    const room = MAX_PAGES - pages.length;
    if (room <= 0) {
      setEngineError(`This workspace holds ${MAX_PAGES} pages. Split a longer book into parts.`);
      return;
    }
    const accepted = chosen.slice(0, room);
    const firstBatch = pages.length === 0;

    const loaded: Page[] = [];
    for (const file of accepted) {
      try {
        const dataUrl = await readAsDataUrl(file);
        const { width, height } = await measure(dataUrl);
        loaded.push({
          id: `upload_${Date.now().toString(36)}_${loaded.length}`,
          name: file.name,
          imageUrl: dataUrl,
          status: 'queued',
          regions: [],
          isComplete: false,
          width,
          height,
        });
      } catch {
        setEngineError(`${file.name} could not be read as an image.`);
      }
    }
    if (loaded.length === 0) return;

    if (accepted.length < chosen.length) {
      setEngineError(`Only the first ${accepted.length} were added; the limit is ${MAX_PAGES} pages.`);
    }

    setPages((prev) => [...prev, ...loaded]);
    if (firstBatch) {
      // A fresh upload is a fresh run of work, so it gets its own folder.
      sessionRef.current = null;
      setExportedTo(null);
      setActivePageId(loaded[0].id);
    }
  };

  // 7. CORE CHAPTER RESET FLOW
  const handleResetChapter = () => {
    const confirmReset = window.confirm(
      'Clear the workspace? This removes every page you loaded and all the boxes and edits on them. Pages you already exported are not affected.'
    );
    if (confirmReset) {
      clearIntentTimers();
      setPages([]);
      setActivePageId('');
      setSelectedRegionId(null);
      setHasUnappliedEdits(false);
      sessionRef.current = null;
      setExportedTo(null);
      setEngineError(null);
    }
  };

  // 8. EXPORT: render this page and write it out
  const handleExportClicked = () => {
    setExportError(null);
    setExportedTo(null);
    setShowExportModal(true);
  };

  /** Ask once per run where results go; declining falls back to downloads. */
  const chooseOutputFolder = async () => {
    try {
      outputRootRef.current = await pickOutputRoot();
      sessionRef.current = null; // reopen under the newly chosen root
      setExportError(null);
    } catch (error) {
      // An abort is the user changing their mind, not a failure to report.
      if ((error as DOMException)?.name !== 'AbortError') {
        setExportError(describeFailure(error));
      }
    }
  };

  const currentSession = async (): Promise<OutputSession> => {
    if (!sessionRef.current) {
      const folder = outputFolderName(pages[0]?.name);
      sessionRef.current = await openOutputSession(folder, outputRootRef.current ?? undefined);
    }
    return sessionRef.current;
  };

  const exportActivePage = async () => {
    if (!activePage?.imageUrl) return;
    setExportProcessing(true);
    setExportComplete(false);
    setExportError(null);

    try {
      const { blob } = await renderTranslatedPage(activePage.imageUrl, activePage.regions, {
        uppercase: settings.uppercase,
      });
      const session = await currentSession();
      const index = pages.findIndex((p) => p.id === activePage.id);
      const fileName = pageFileName(Math.max(0, index), activePage.name);
      await session.write(fileName, blob);

      setExportedTo(
        session.kind === 'directory'
          ? `Results/${session.folderName}/${fileName}`
          : `${fileName} (downloaded)`,
      );
      setExportComplete(true);
      // An exported page is a finished page.
      setPages((prev) => prev.map((p) => (p.id === activePage.id ? { ...p, isComplete: true, status: 'done' } : p)));
    } catch (error) {
      setExportError(describeFailure(error));
    } finally {
      setExportProcessing(false);
    }
  };

  const approvedCount = activePage?.regions.filter((r) => r.isApplied && !r.isHidden).length ?? 0;

  const shellClass = `h-screen w-screen font-sans flex flex-col select-none overflow-hidden antialiased transition-colors duration-200 ${
    theme === 'dark' ? 'bg-stone-950 text-stone-200' : 'bg-[#F3F4F6] text-gray-800'
  }`;

  // Nothing is loaded yet. There are no built-in pages any more: the input is
  // whatever the user brings.
  if (pages.length === 0) {
    return (
      <div className={`${shellClass} items-center justify-center`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          multiple
          className="hidden"
        />
        <div className="max-w-md px-6 text-center">
          <h1 className="text-lg font-bold tracking-tight">Comic Translator</h1>
          <p className={`mt-2 text-sm leading-relaxed ${theme === 'dark' ? 'text-stone-400' : 'text-gray-500'}`}>
            Load up to {MAX_PAGES} pages. Nothing is written out until you approve it,
            and each page you approve is saved on its own.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={handleUploadClicked}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Choose images
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${
                theme === 'dark'
                  ? 'border-stone-700 text-stone-300 hover:bg-stone-800'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {engineLabel}
            </button>
          </div>
          {engineError && <p className="mt-4 text-xs text-red-500">{engineError}</p>}
        </div>
        {showSettings && (
          <SettingsModal
            settings={settings}
            theme={theme}
            onClose={() => setShowSettings(false)}
            onSave={(next) => { setSettings(next); saveSettings(next); setShowSettings(false); }}
          />
        )}
      </div>
    );
  }

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
        multiple
        className="hidden"
      />

      {/* MENUBAR HEADER */}
      <Menubar
        onResetChapter={handleResetChapter}
        onUploadClicked={handleUploadClicked}
        onExportClicked={handleExportClicked}
        onHelpClicked={() => setShowHelpModal(true)}
        onSettingsClicked={() => setShowSettings(true)}
        engineLabel={engineLabel}
        engineKind={settings.engine.kind}
        engineReady={engineReady}
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

      {/* POPUP C: WRITE THIS PAGE OUT */}
      {showExportModal && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl ${
            theme === 'dark' ? 'border-stone-700 bg-stone-900 text-stone-200' : 'border-gray-200 bg-white text-gray-800'
          }`}>
            <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
              theme === 'dark' ? 'border-stone-800 bg-stone-950' : 'border-gray-100 bg-gray-50'
            }`}>
              <h2 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider">
                <Download size={14} className={exportComplete ? 'text-emerald-500' : 'text-blue-500'} />
                Export this page
              </h2>
              {!exportProcessing && (
                <button onClick={() => setShowExportModal(false)} aria-label="Close" className={theme === 'dark' ? 'text-stone-400' : 'text-gray-400'}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="space-y-4 p-5">
              <div className={`rounded-lg border p-3 font-mono text-[11px] leading-relaxed ${
                theme === 'dark' ? 'border-stone-800 bg-stone-950 text-stone-400' : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}>
                <p><span className="opacity-60">Page:</span> {activePage.name}</p>
                <p><span className="opacity-60">Approved regions to set:</span> {approvedCount}</p>
                <p><span className="opacity-60">Hidden regions:</span> {activePage.regions.filter((r) => r.isHidden).length}</p>
                <p><span className="opacity-60">Folder:</span> Results/{outputFolderName(pages[0]?.name)}/</p>
                <p><span className="opacity-60">Written as:</span> {pageFileName(Math.max(0, pages.findIndex((p) => p.id === activePage.id)), activePage.name)}</p>
              </div>

              {approvedCount === 0 && (
                <p className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                  theme === 'dark' ? 'border-amber-900/50 bg-amber-950/30 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  No region on this page is approved yet, so the page will be written out unchanged.
                  Approve the ones you want with “Apply Changes” first.
                </p>
              )}

              {supportsDirectoryOutput() ? (
                <button
                  onClick={chooseOutputFolder}
                  disabled={exportProcessing}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                    theme === 'dark' ? 'border-stone-700 hover:bg-stone-800' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {outputRootRef.current ? `Folder chosen: ${outputRootRef.current.name}` : 'Choose where to save…'}
                </button>
              ) : (
                <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'text-stone-400' : 'text-gray-500'}`}>
                  This browser cannot write into a folder you pick, so each page downloads on its own.
                </p>
              )}

              {exportError && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">{exportError}</p>
              )}
              {exportComplete && exportedTo && (
                <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                  <CheckCircle size={14} /> Written to {exportedTo}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={exportProcessing}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                    theme === 'dark' ? 'border-stone-700 text-stone-300 hover:bg-stone-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Back to canvas
                </button>
                <button
                  id="export-write-btn"
                  onClick={exportActivePage}
                  disabled={exportProcessing}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {exportProcessing ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>{exportProcessing ? 'Writing…' : 'Write this page'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          theme={theme}
          onClose={() => setShowSettings(false)}
          onSave={(next) => { setSettings(next); saveSettings(next); setShowSettings(false); }}
        />
      )}

      {/* ENGINE PROGRESS AND FAILURES -- never silent, never invented */}
      {(engineStatus || engineError) && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-[80] -translate-x-1/2">
          <div className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] shadow-lg ${
            engineError
              ? 'border-red-300 bg-red-50 text-red-700'
              : theme === 'dark' ? 'border-stone-700 bg-stone-900 text-stone-300' : 'border-gray-200 bg-white text-gray-600'
          }`}>
            {engineError ? <AlertTriangle size={13} /> : <RefreshCw size={13} className="animate-spin" />}
            <span>{engineError ?? engineStatus}</span>
            {engineError && (
              <button onClick={() => setEngineError(null)} aria-label="Dismiss" className="ml-1 opacity-60">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
