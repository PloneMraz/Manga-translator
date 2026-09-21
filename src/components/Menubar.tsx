/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Cpu,
  KeyRound,
  Settings
} from 'lucide-react';

interface MenubarProps {
  onResetChapter: () => void;
  onUploadClicked: () => void;
  onExportClicked: () => void;
  onHelpClicked: () => void;
  onSettingsClicked: () => void;
  /** Which engine is selected, shown in the status pill. */
  engineLabel: string;
  engineKind: 'ai' | 'offline';
  /** False when the chosen engine cannot run yet -- an AI engine with no key. */
  engineReady: boolean;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export const Menubar: React.FC<MenubarProps> = ({
  onResetChapter,
  onUploadClicked,
  onExportClicked,
  onHelpClicked,
  onSettingsClicked,
  engineLabel,
  engineKind,
  engineReady,
  theme,
  onThemeChange
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const toggleDropdown = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  return (
    <div
      id="photoshop-menu-header"
      className={`h-10 border-b flex items-center justify-between px-4 select-none shrink-0 relative z-50 transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-stone-900 border-stone-850 text-stone-100'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      
      {/* Upper left menus */}
      <div className="flex items-center space-x-6">
        
        {/* APP BRAND TITLE */}
        <div className="flex items-center space-x-2 mr-2">
          <div className="w-4 h-4 bg-blue-600 rounded-sm"></div>
          <span className={`font-bold tracking-wider font-sans text-xs ${
            theme === 'dark' ? 'text-stone-100' : 'text-gray-900'
          }`}>
            COMIC TRANSLATOR
          </span>
        </div>

        {/* INTERACTIVE dropdown files */}
        <div className="flex space-x-2 font-sans">
          
          {/* File Menu */}
          <div className="relative">
            <button
              id="menu-file-btn"
              onClick={() => toggleDropdown('file')}
              className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded cursor-pointer transition-colors ${
                activeMenu === 'file'
                  ? theme === 'dark' ? 'bg-stone-800 text-blue-400' : 'bg-gray-100 text-blue-600'
                  : theme === 'dark' ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className={`absolute left-0 mt-1.5 w-48 border rounded-lg shadow-xl py-1 z-50 text-[11.5px] transition-all ${
                theme === 'dark'
                  ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-stone-950/50'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}>
                <button
                  onClick={() => handleMenuAction(onUploadClicked)}
                  className={`w-full text-left px-3.5 py-2 flex items-center space-x-2 transition-colors ${
                    theme === 'dark' ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Upload size={13} className={theme === 'dark' ? 'text-stone-500' : 'text-gray-400'} />
                  <span>Import Manga Page...</span>
                </button>
                <button
                  onClick={() => handleMenuAction(onResetChapter)}
                  className={`w-full text-left px-3.5 py-2 flex items-center space-x-2 transition-colors ${
                    theme === 'dark' ? 'hover:bg-stone-800 text-red-400' : 'hover:bg-gray-50 text-red-600'
                  }`}
                >
                  <RotateCcw size={13} className={theme === 'dark' ? 'text-red-400' : 'text-red-500'} />
                  <span>Reset Chapter Progress</span>
                </button>
                <div className={`border-t my-1 ${theme === 'dark' ? 'border-stone-805' : 'border-gray-100'}`}></div>
                <button
                  onClick={() => handleMenuAction(() => alert('Pages within three of the one you are on are prepared in advance. Nothing is cached to disk; pages live in memory until you export them.'))}
                  className={`w-full text-left px-3.5 py-2 font-mono text-[10.5px] transition-colors ${
                    theme === 'dark' ? 'hover:bg-stone-800 text-stone-500' : 'hover:bg-gray-50 text-gray-400'
                  }`}
                >
                  Show Stack Memory
                </button>
              </div>
            )}
          </div>

          {/* Selection Menu */}
          <div className="relative">
            <button
              id="menu-selection-btn"
              onClick={() => toggleDropdown('selection')}
              className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded cursor-pointer transition-colors ${
                activeMenu === 'selection'
                  ? theme === 'dark' ? 'bg-stone-800 text-blue-400' : 'bg-gray-100 text-blue-600'
                  : theme === 'dark' ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Selection
            </button>
            {activeMenu === 'selection' && (
              <div className={`absolute left-0 mt-1.5 w-48 border rounded-lg shadow-xl py-1 z-50 text-[11.5px] transition-all ${
                theme === 'dark'
                  ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-stone-950/50'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}>
                <div className={`px-3.5 py-1 text-[10px] font-mono uppercase border-b pb-1 mb-1 font-bold ${
                  theme === 'dark' ? 'text-stone-500 border-stone-805' : 'text-gray-400 border-gray-100'
                }`}>
                  Classifier Overrides
                </div>
                <div className={`px-3.5 py-1.5 text-[10.5px] italic leading-snug ${
                  theme === 'dark' ? 'text-stone-400' : 'text-gray-500'
                }`}>
                  Select a region on canvas, then utilize properties override dropdown in the right panel to recast initial machine classifications.
                </div>
              </div>
            )}
          </div>

          {/* Export Menu */}
          <div className="relative">
            <button
              id="menu-export-btn"
              onClick={() => toggleDropdown('export')}
              className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded cursor-pointer transition-colors ${
                activeMenu === 'export'
                  ? theme === 'dark' ? 'bg-stone-800 text-blue-400' : 'bg-gray-100 text-blue-600'
                  : theme === 'dark' ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Export
            </button>
            {activeMenu === 'export' && (
              <div className={`absolute left-0 mt-1.5 w-52 border rounded-lg shadow-xl py-1 z-50 text-[11.5px] transition-all ${
                theme === 'dark'
                  ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-stone-950/50'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}>
                <button
                  id="menu-export-page-btn"
                  onClick={() => handleMenuAction(onExportClicked)}
                  className={`w-full text-left px-3.5 py-2 flex items-center space-x-2 transition-colors ${
                    theme === 'dark' ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Download size={13} className="text-blue-500" />
                  <span>Write this page out&hellip;</span>
                </button>
              </div>
            )}
          </div>

          {/* Appearance Menu */}
          <div className="relative">
            <button
              id="menu-appearance-btn"
              onClick={() => toggleDropdown('appearance')}
              className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded cursor-pointer transition-colors ${
                activeMenu === 'appearance'
                  ? theme === 'dark' ? 'bg-stone-800 text-blue-400' : 'bg-gray-100 text-blue-600'
                  : theme === 'dark' ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Appearance
            </button>
            {activeMenu === 'appearance' && (
              <div className={`absolute left-0 mt-1.5 w-44 border rounded-lg shadow-xl py-1 z-50 text-[11.5px] transition-all ${
                theme === 'dark'
                  ? 'bg-stone-900 border-stone-805 text-stone-200 shadow-stone-950/50'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}>
                <div className={`px-3.5 py-1 text-[10px] font-mono uppercase border-b pb-1 mb-1 font-bold ${
                  theme === 'dark' ? 'text-stone-500 border-stone-800' : 'text-gray-400 border-gray-100'
                }`}>
                  Theme Preference
                </div>
                <button
                  onClick={() => handleMenuAction(() => onThemeChange('light'))}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                    theme === 'dark' ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-gray-50 text-gray-705'
                  }`}
                >
                  <span className={theme === 'light' ? 'font-bold text-blue-600' : ''}>Light (Default)</span>
                  {theme === 'light' && <span className="text-blue-600 text-xs font-bold">✓</span>}
                </button>
                <button
                  onClick={() => handleMenuAction(() => onThemeChange('dark'))}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                    theme === 'dark' ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-gray-50 text-gray-705'
                  }`}
                >
                  <span className={theme === 'dark' ? 'font-bold text-blue-400' : ''}>Dark</span>
                  {theme === 'dark' && <span className="text-blue-500 text-xs font-bold">✓</span>}
                </button>
              </div>
            )}
          </div>
          
        </div>

      </div>

      {/* Upper right systems - API presence & Help */}
      <div className="flex items-center space-x-3 text-gray-500">
        
        {/* WHICH ENGINE IS SELECTED -- click to change it */}
        <button
          id="engine-status-indicator"
          onClick={onSettingsClicked}
          title="Translation settings"
          className={`flex items-center space-x-2 px-2.5 py-0.5 border rounded-full select-none text-[10px] font-mono cursor-pointer transition-colors ${
            theme === 'dark'
              ? 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-600'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {engineKind === 'offline' ? (
            <Cpu size={12} className="text-blue-500" />
          ) : (
            <KeyRound size={12} className={engineReady ? 'text-emerald-500' : 'text-amber-500'} />
          )}
          <span className={`font-medium uppercase ${engineReady ? '' : 'text-amber-600'}`}>
            {engineReady ? engineLabel : `${engineLabel} — no key`}
          </span>
          <Settings size={11} className="opacity-60" />
        </button>

        {/* HELP MANUAL BUTTON */}
        <button
          id="menubar-help-btn"
          onClick={onHelpClicked}
          className={`p-1 px-2.5 rounded flex items-center space-x-1 text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
            theme === 'dark'
              ? 'text-stone-450 hover:bg-stone-800 hover:text-stone-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          }`}
          title="Workflow Guild Help"
        >
          <HelpCircle size={13} className={theme === 'dark' ? 'text-stone-500' : 'text-gray-400'} />
          <span>Help</span>
        </button>

      </div>

    </div>
  );
};
