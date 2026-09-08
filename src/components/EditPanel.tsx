/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Region, RegionType } from '../types';
import {
  Type,
  CheckCircle,
  EyeOff,
  Eye,
  Trash2,
  Bold,
  ListFilter,
  Layers,
  Sparkles,
  Check,
  AlertTriangle
} from 'lucide-react';

interface EditPanelProps {
  regions: Region[];
  selectedRegionId: string | null;
  onRegionSelected: (id: string | null) => void;
  onRegionUpdated: (region: Region) => void;
  onRegionDeleted: (id: string) => void;
  onActiveEditChanged: (isEditing: boolean) => void;
  theme: 'light' | 'dark';
}

const FONTS_LIST = [
  'Comic Neue',
  'Bangers',
  'Architects Daughter',
  'Sedgwick Ave',
  'Cinzel',
  'Impact',
  'Arial'
];

export const EditPanel: React.FC<EditPanelProps> = ({
  regions,
  selectedRegionId,
  onRegionSelected,
  onRegionUpdated,
  onRegionDeleted,
  onActiveEditChanged,
  theme,
}) => {
  const activeRegion = regions.find((r) => r.id === selectedRegionId);

  // States for selected card fields
  const [localType, setLocalType] = useState<RegionType>('bubble');
  const [localTranslation, setLocalTranslation] = useState('');
  const [localFont, setLocalFont] = useState('Comic Neue');
  const [localFontSize, setLocalFontSize] = useState<number | 'auto'>('auto');
  const [localAlign, setLocalAlign] = useState<'left' | 'center' | 'right'>('center');
  const [localIsHidden, setLocalIsHidden] = useState(false);

  // Sync edits state with parenthood to guard jumps and page change warn alerts
  const [hasUnappliedEdits, setHasUnappliedEdits] = useState(false);

  // Reset fields when active region index shifts
  useEffect(() => {
    if (activeRegion) {
      setLocalType(activeRegion.type);
      setLocalTranslation(activeRegion.translatedText || '');
      setLocalFont(activeRegion.font || 'Comic Neue');
      setLocalFontSize(activeRegion.fontSize || 'auto');
      setLocalAlign(activeRegion.align || 'center');
      setLocalIsHidden(activeRegion.isHidden || false);
      setHasUnappliedEdits(false);
      onActiveEditChanged(false);
    } else {
      setHasUnappliedEdits(false);
      onActiveEditChanged(false);
    }
  }, [selectedRegionId, activeRegion]);

  // Handle live inputs changes checks
  const handleFieldChange = (changedFieldName: string, newValue: any) => {
    setHasUnappliedEdits(true);
    onActiveEditChanged(true);

    if (changedFieldName === 'type') setLocalType(newValue);
    if (changedFieldName === 'translation') setLocalTranslation(newValue);
    if (changedFieldName === 'font') setLocalFont(newValue);
    if (changedFieldName === 'fontSize') setLocalFontSize(newValue);
    if (changedFieldName === 'align') setLocalAlign(newValue);
    if (changedFieldName === 'isHidden') setLocalIsHidden(newValue);
  };

  // Select Engine Badge per Region Type Taxonomy
  const getOcrEngineRouting = (type: RegionType) => {
    switch (type) {
      case 'bubble':
        return { name: 'manga-ocr (Specialist)', details: 'High-speed vertical line layout analyser optimized for Manga bubbles.' };
      case 'narrator':
        return { name: 'EasyOCR (General Multilingual)', details: 'Horizontal grid-search OCR tailored for dense caption fonts.' };
      case 'sfx':
        return { name: 'PaddleOCR + Gemini fallback', details: 'Heuristics-guided boundary boxes for handwritten sound effect sketches.' };
      case 'author_note':
        return { name: 'TrOCR (Microsoft Handwriting)', details: 'Deep-learning based handwritten transformer for fine text.' };
      case 'title':
        return { name: 'Manually Flagged (Skipped)', details: 'Logo text and stylized titles bypass standard neural networks.' };
      default:
        return { name: 'easyOCR', details: 'Standard OCR routing.' };
    }
  };

  const handleApply = () => {
    if (!activeRegion) return;

    const updatedRegion: Region = {
      ...activeRegion,
      type: localType,
      translatedText: localTranslation,
      font: localFont,
      fontSize: localFontSize,
      align: localAlign,
      isHidden: localIsHidden,
      isApplied: true, // Marked applied!
    };

    onRegionUpdated(updatedRegion);
    setHasUnappliedEdits(false);
    onActiveEditChanged(false);
  };

  const handleToggleHide = () => {
    if (!activeRegion) return;
    const hideState = !localIsHidden;
    setLocalIsHidden(hideState);
    
    // Auto apply hide action silently
    const updatedRegion: Region = {
      ...activeRegion,
      isHidden: hideState,
      isApplied: hideState ? activeRegion.isApplied : true
    };
    onRegionUpdated(updatedRegion);
    setHasUnappliedEdits(false);
    onActiveEditChanged(false);
  };

  return (
    <div
      id="side-edit-panel"
      className={`w-[360px] border-l flex flex-col flex-shrink-0 transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-stone-900 border-stone-850 text-stone-300'
          : 'bg-white border-l border-gray-200 text-gray-700'
      }`}
    >
      
      {/* SECTION 1: REGIONS LIST VIEW */}
      <div
        id="regions-list-section"
        className={`flex-1 min-h-[220px] max-h-[35%] border-b flex flex-col ${
          theme === 'dark' ? 'border-stone-850' : 'border-gray-200'
        }`}
      >
        <div className={`px-4 py-3 flex items-center justify-between border-b ${
          theme === 'dark' ? 'bg-stone-950 border-stone-850' : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex items-center space-x-2">
            <Layers size={15} className="text-blue-500" />
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'text-stone-200' : 'text-gray-800'
            }`}>Regions List</span>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
            theme === 'dark' ? 'bg-stone-800 text-stone-400 border border-stone-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {regions.length} detected
          </span>
        </div>

        {/* Regions Scrolling Items Box */}
        <div className={`flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar ${
          theme === 'dark' ? 'bg-stone-900' : 'bg-white'
        }`}>
          {regions.length === 0 ? (
            <div className="text-[11px] text-gray-400 text-center py-8">
              No detected boxes on current page.<br />Use Draw Region (R) to place some.
            </div>
          ) : (
            regions.map((reg) => {
              const isSelected = reg.id === selectedRegionId;
              return (
                <div
                  key={reg.id}
                  id={`region-list-item-${reg.id}`}
                  onClick={() => onRegionSelected(reg.id)}
                  className={`px-3 py-2 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${
                    isSelected
                      ? theme === 'dark'
                        ? 'bg-blue-650/20 border-blue-500 text-blue-400 shadow-sm'
                        : 'bg-blue-50/70 border-blue-400 text-blue-600 shadow-sm'
                      : reg.isApplied
                      ? theme === 'dark'
                        ? 'bg-emerald-650/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-650/20'
                        : 'bg-emerald-50/40 border-emerald-205 text-emerald-600 hover:bg-emerald-50/70'
                      : reg.isHidden
                      ? theme === 'dark'
                        ? 'bg-stone-950/40 border-stone-850 text-stone-550 line-through'
                        : 'bg-gray-50/55 border-gray-100 text-gray-400 line-through'
                      : theme === 'dark'
                        ? 'bg-stone-850/30 border-stone-800 text-stone-300 hover:bg-stone-800 hover:border-stone-750'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-[9px] font-mono uppercase border px-1.5 py-0.5 rounded-md w-max mb-1 font-bold ${
                      theme === 'dark' ? 'bg-stone-950 border-stone-800 text-stone-400' : 'bg-gray-100 border-gray-200 text-gray-500'
                    }`}>
                      {reg.type}
                    </span>
                    <span className={`text-[11px] font-sans font-medium truncate ${
                      theme === 'dark' ? 'text-stone-200' : 'text-gray-800'
                    }`}>
                      {reg.ocrText || '[Empty Transcription]'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {reg.isApplied && <Check size={13} className="text-emerald-500 animate-fade-in" />}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegionDeleted(reg.id);
                      }}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        theme === 'dark' ? 'text-stone-500 hover:text-red-400 hover:bg-red-950/30' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Delete detection box"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECTION 2: EDIT ACTIVE REGION PROPERTIES */}
      <div
        id="region-props-editor"
        className={`flex-[2] flex flex-col overflow-y-auto ${
          theme === 'dark' ? 'bg-stone-900' : 'bg-white'
        }`}
      >
        <div className={`px-4 py-3 flex items-center space-x-2 border-b ${
          theme === 'dark' ? 'bg-stone-950 border-stone-850' : 'bg-gray-55 border-gray-200'
        }`}>
          <Type size={15} className="text-blue-500" />
          <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
            theme === 'dark' ? 'text-stone-200' : 'text-gray-800'
          }`}>Properties Panel</span>
        </div>

        {activeRegion ? (
          <div className="p-4 space-y-4 flex-1">
            
            {/* Classification Override Buttons */}
            <div>
              <label className={`text-[10px] font-mono uppercase block mb-1.5 font-bold ${
                theme === 'dark' ? 'text-stone-500' : 'text-gray-400'
              }`}>
                classification type
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['bubble', 'narrator', 'sfx', 'author_note', 'title'] as RegionType[]).map((t) => (
                  <button
                    key={t}
                    id={`type-btn-${t}`}
                    onClick={() => handleFieldChange('type', t)}
                    className={`text-[9.5px] font-mono py-1 rounded-md capitalize border transition-all truncate px-1 text-center cursor-pointer ${
                      localType === t
                        ? theme === 'dark'
                          ? 'bg-blue-650/40 border-blue-500 text-blue-400 font-bold shadow-sm'
                          : 'bg-blue-50 border-blue-300 text-blue-600 font-bold shadow-sm'
                        : theme === 'dark'
                          ? 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                          : 'bg-white border-gray-205 text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Readonly OCR Transcription Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-[10px] font-mono uppercase font-bold ${
                  theme === 'dark' ? 'text-stone-550' : 'text-gray-400'
                }`}>
                  OCR TRANSCRIPTION (IN SOURCE LANGUAGE)
                </label>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full border font-bold truncate max-w-[150px] ${
                  theme === 'dark' ? 'text-blue-400 bg-blue-950/30 border-blue-900' : 'text-blue-600 bg-blue-50 border-blue-100'
                }`} title={getOcrEngineRouting(localType).details}>
                  {getOcrEngineRouting(localType).name}
                </span>
              </div>
              <textarea
                id="ocr-input"
                readOnly
                value={activeRegion.ocrText}
                className={`w-full h-14 text-xs font-sans p-2 rounded-lg outline-none select-text resize-none leading-relaxed border ${
                  theme === 'dark' ? 'bg-stone-950 border-stone-850 text-stone-400' : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              />
            </div>

            {/* Editable Translation suggested area */}
            <div>
              <label className={`text-[10px] font-mono uppercase block mb-1 font-bold ${
                theme === 'dark' ? 'text-stone-500' : 'text-gray-400'
              }`}>
                ENGLISH TRANSLATION
              </label>
              <textarea
                id="translation-input"
                value={localTranslation}
                onChange={(e) => handleFieldChange('translation', e.target.value)}
                placeholder="Awaiting Intent / Loading translation suggestion..."
                className={`w-full h-18 text-xs font-sans p-2 rounded-lg outline-none select-text resize-none font-medium border ${
                  theme === 'dark'
                    ? 'bg-stone-950 border-stone-850 text-stone-100 focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                }`}
              />
            </div>

            {/* Typography Selection (Fonts and Sizes and auto-fit toggle) */}
            <div className={`border-t pt-3 ${theme === 'dark' ? 'border-stone-800' : 'border-gray-100'}`}>
              <label className={`text-[10px] font-mono uppercase block mb-2 font-bold ${
                theme === 'dark' ? 'text-stone-500' : 'text-gray-400'
              }`}>
                TYPOGRAPHY LAYOUT
              </label>
              
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Font selection */}
                <div>
                  <span className={`text-[9px] block mb-1 font-mono font-bold ${
                    theme === 'dark' ? 'text-stone-505' : 'text-gray-400'
                  }`}>FONT</span>
                  <select
                    id="font-family-select"
                    value={localFont}
                    onChange={(e) => handleFieldChange('font', e.target.value)}
                    className={`w-full text-xs px-2 py-1 rounded-lg outline-none border cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-stone-950 border-stone-850 text-stone-200 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-50'
                    }`}
                  >
                    {FONTS_LIST.map((f) => (
                      <option key={f} value={f} className={theme === 'dark' ? 'bg-stone-950 text-stone-200' : ''}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Text Alignment */}
                <div>
                  <span className={`text-[9px] block mb-1 font-mono font-bold ${
                    theme === 'dark' ? 'text-stone-505' : 'text-gray-400'
                  }`}>ALIGNMENT</span>
                  <div className={`flex rounded-lg overflow-hidden border ${
                    theme === 'dark' ? 'bg-stone-950 border-stone-850' : 'bg-white border-gray-200'
                  }`}>
                    {(['left', 'center', 'right'] as const).map((pos) => (
                      <button
                        key={pos}
                        id={`align-btn-${pos}`}
                        onClick={() => handleFieldChange('align', pos)}
                        className={`flex-1 text-center py-1 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                          localAlign === pos
                            ? theme === 'dark'
                              ? 'bg-blue-650/40 text-blue-400 font-bold'
                              : 'bg-blue-50 text-blue-600 font-bold'
                            : theme === 'dark'
                            ? 'text-stone-550 hover:text-stone-200 hover:bg-stone-800'
                            : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        {pos.slice(0, 1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Slider Font Size and Auto-fit toggle */}
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-bold font-mono ${
                  theme === 'dark' ? 'text-stone-500' : 'text-gray-400'
                }`}>FONT SIZE</span>
                <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                  <input
                    id="chk-autofit-fontsize"
                    type="checkbox"
                    checked={localFontSize === 'auto'}
                    onChange={(e) => handleFieldChange('fontSize', e.target.checked ? 'auto' : 14)}
                    className="w-3.5 h-3.5 text-blue-600 focus:ring-0 rounded bg-white border-gray-300"
                  />
                  <span className={`text-[9.5px] font-mono font-semibold ${
                    theme === 'dark' ? 'text-stone-400' : 'text-gray-500'
                  }`}>Auto-fit bubble</span>
                </label>
              </div>

              {localFontSize !== 'auto' && (
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    id="fs-range"
                    type="range"
                    min="6"
                    max="36"
                    value={localFontSize as number}
                    onChange={(e) => handleFieldChange('fontSize', parseInt(e.target.value))}
                    className="flex-1 accent-blue-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded border min-w-[28px] text-center font-bold ${
                    theme === 'dark' ? 'bg-stone-950 border-stone-850 text-stone-300' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    {localFontSize}px
                  </span>
                </div>
              )}
            </div>

            {/* UNAPPLIED CHANGES BANNER */}
            {hasUnappliedEdits && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-start space-x-2 text-[10.5px] text-amber-500">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-500 animate-pulse" />
                <div>
                  <span className="font-bold">Unapplied Changes:</span> Your modifications have not been saved to the workspace canvas yet. Click <span className="underline">Apply changes</span>.
                </div>
              </div>
            )}

            {/* ACTIONS BUTTONS */}
            <div className={`flex space-x-2 pt-3 border-t ${
              theme === 'dark' ? 'border-stone-800' : 'border-gray-100'
            }`}>
              <button
                id="btn-properties-hide"
                onClick={handleToggleHide}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-lg font-medium text-xs border transition-colors cursor-pointer ${
                  localIsHidden
                    ? 'bg-amber-600 text-white border-amber-500 hover:bg-amber-700'
                    : theme === 'dark'
                      ? 'bg-stone-900 text-stone-300 border-stone-800 hover:bg-stone-850 hover:text-stone-100'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {localIsHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{localIsHidden ? 'Render Region' : 'Hide from Export'}</span>
              </button>

              <button
                id="btn-properties-apply"
                onClick={handleApply}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm border border-blue-650 transition-colors cursor-pointer"
              >
                <CheckCircle size={14} />
                <span>Apply Changes</span>
              </button>
            </div>

          </div>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none min-h-[300px] ${
            theme === 'dark' ? 'text-stone-605' : 'text-gray-400'
          }`}>
            <Sparkles size={28} className={`mb-2 ${theme === 'dark' ? 'text-stone-750' : 'text-gray-300'}`} />
            <span className={`text-xs font-semibold tracking-wide ${
              theme === 'dark' ? 'text-stone-400' : 'text-gray-600'
            }`}>NO ACTIVE SELECTION</span>
            <span className={`text-[10px] font-mono mt-1 leading-relaxed ${
              theme === 'dark' ? 'text-stone-500' : 'text-gray-450'
            }`}>
              Click any colored bounding box on the Canvas or item in the Regions List to initiate translation tuning.
            </span>
          </div>
        )}
      </div>

    </div>
  );
};
