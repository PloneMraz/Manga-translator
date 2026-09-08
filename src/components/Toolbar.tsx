/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Region, ToolType } from '../types';
import {
  MousePointer,
  Square,
  PenTool,
  Hand,
  ZoomIn,
  Eye,
  Paintbrush,
  SquareSplitHorizontal,
  Info
} from 'lucide-react';


interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  textPreviewEnabled: boolean;
  setTextPreviewEnabled: (enabled: boolean) => void;
  compareModeEnabled: boolean;
  setCompareModeEnabled: (enabled: boolean) => void;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  theme: 'light' | 'dark';
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  textPreviewEnabled,
  setTextPreviewEnabled,
  compareModeEnabled,
  setCompareModeEnabled,
  zoomLevel,
  setZoomLevel,
  theme
}) => {
  const toolsList = [
    { id: 'select' as ToolType, label: 'Select Tool (V)', icon: MousePointer, desc: 'Click to select / resize speech bubbles or text regions.' },
    { id: 'draw' as ToolType, label: 'Draw Region (R)', icon: Square, desc: 'Click & drag on canvas to quickly add a new rectangular detection box.' },
    { id: 'lasso' as ToolType, label: 'Lasso Region (L)', icon: PenTool, desc: 'Define irregular/freeform outline areas for stylized background SFX.' },
    { id: 'pan' as ToolType, label: 'Pan Canvas (H)', icon: Hand, desc: 'Drag viewport to navigate around large multi-panel comic pages.' },
    { id: 'zoom' as ToolType, label: 'Zoom View (Z)', icon: ZoomIn, desc: 'Click to scale up, double-click or use sliders to adjust zoom scale.' },
    { id: 'brush' as ToolType, label: 'Inpaint Brush (B)', icon: Paintbrush, desc: 'Simulate manual content-aware touchups or paint over source remnants.' },
  ];

  const handleZoomIncrement = () => {
    setZoomLevel(zoomLevel >= 2.5 ? 1.0 : zoomLevel + 0.25);
  };

  return (
    <div
      id="photoshop-toolbar"
      className={`w-[66px] border-r flex flex-col items-center py-4 flex-shrink-0 justify-between transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-stone-900 border-stone-850'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Upper Main Interactive Tools */}
      <div className="flex flex-col space-y-2 w-full px-2 items-center">
        <div className={`text-[9px] font-mono tracking-widest font-bold mb-2 uppercase select-none ${
          theme === 'dark' ? 'text-stone-500' : 'text-gray-400'
        }`}>
          Tools
        </div>

        {toolsList.map((tool) => {
          const IconComponent = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              id={`tool-btn-${tool.id}`}
              onClick={() => {
                if (tool.id === 'zoom') {
                  handleZoomIncrement();
                } else {
                  setActiveTool(tool.id);
                }
              }}
              className={`group relative w-11 h-11 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-blue-650/20 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm'
                  : theme === 'dark'
                    ? 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
                    : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'
              }`}
              title={tool.label}
            >
              <IconComponent size={19} strokeWidth={isActive ? 2.5 : 1.75} />
              
              {/* Desktop Tooltips */}
              <div className={`absolute left-[70px] top-1 border text-[11px] px-2.5 py-1.5 rounded-lg min-w-[200px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg leading-relaxed ${
                theme === 'dark'
                  ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-black/40'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}>
                <p className={`font-bold text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{tool.label}</p>
                <p className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-stone-400' : 'text-gray-500'}`}>{tool.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Downward Visualization Filters (Text Preview, Compare) */}
      <div className={`flex flex-col space-y-3 w-full px-2 items-center border-t pt-4 ${
        theme === 'dark' ? 'border-stone-800' : 'border-gray-200'
      }`}>
        <div className={`text-[9px] font-mono tracking-widest font-bold mb-1 uppercase select-none ${
          theme === 'dark' ? 'text-stone-500' : 'text-gray-400'
        }`}>
          View
        </div>

        {/* Text Preview Overlay Button */}
        <button
          id="btn-toggle-text-preview"
          onClick={() => setTextPreviewEnabled(!textPreviewEnabled)}
          className={`group relative w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            textPreviewEnabled
              ? theme === 'dark'
                ? 'bg-emerald-650/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
              : theme === 'dark'
                ? 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
                : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'
          }`}
          title="Toggle Text Preview (T)"
        >
          <Eye size={18} />
          <span className="text-[8px] font-mono mt-0.5 font-bold scale-90">PREV</span>
          
          <div className={`absolute left-[70px] bottom-2 border text-[11px] px-2.5 py-1.5 rounded-lg min-w-[200px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg ${
            theme === 'dark'
              ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-black/40'
              : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <p className={`font-bold text-xs ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>Text Preview Overlay</p>
            <p className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-stone-450' : 'text-gray-550'}`}>Toggle live rendered English text layer directly over speech areas.</p>
          </div>
        </button>

        {/* Compare / Split Button */}
        <button
          id="btn-toggle-compare"
          onClick={() => setCompareModeEnabled(!compareModeEnabled)}
          className={`group relative w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            compareModeEnabled
              ? theme === 'dark'
                ? 'bg-blue-650/20 text-blue-400 border border-blue-500/30 shadow-sm'
                : 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm'
              : theme === 'dark'
                ? 'text-stone-500 hover:text-stone-200 hover:bg-stone-800'
                : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'
          }`}
          title="Compare Before/After (C)"
        >
          <SquareSplitHorizontal size={18} />
          <span className="text-[8px] font-mono mt-0.5 font-bold scale-90">COMP</span>

          <div className={`absolute left-[70px] bottom-1 border text-[11px] px-2.5 py-1.5 rounded-lg min-w-[200px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg ${
            theme === 'dark'
              ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-black/40'
              : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <p className={`font-bold text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Compare Mode (A/B)</p>
            <p className={`text-[10px] mt-0.5 ${theme === 'dark' ? 'text-stone-450' : 'text-gray-550'}`}>Hold to toggle between the original comic artwork grid vs the fully processed English-inpainted page.</p>
          </div>
        </button>

        {/* Helper info stat */}
        <div className={`text-[10px] font-mono text-center flex flex-col items-center mt-2 group relative ${
          theme === 'dark' ? 'text-stone-400' : 'text-gray-500'
        }`}>
          <Info size={14} className="text-gray-400 cursor-help" />
          <span className="mt-1 font-semibold">{Math.floor(zoomLevel * 100)}%</span>
          
          <div className={`absolute left-[70px] bottom-0 border text-[11px] px-3 py-2 rounded-lg min-w-[170px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg ${
            theme === 'dark'
              ? 'bg-stone-900 border-stone-800 text-stone-200 shadow-black/40'
              : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <ul className={`text-[10px] space-y-1 ${theme === 'dark' ? 'text-stone-400' : 'text-gray-500'}`}>
              <li>• Click Zoom Icon to cycle scale</li>
              <li>• Key V: Select cursor</li>
              <li>• Key R: Draw Box</li>
              <li>• Key B: Touchup Brush</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
