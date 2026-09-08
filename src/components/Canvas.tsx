/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Region, ToolType } from '../types';
import { ComicPanels } from './ComicPanels';

interface CanvasProps {
  activePageId: string;
  customImageUrl: string | null;
  regions: Region[];
  selectedRegionId: string | null;
  onRegionSelected: (id: string | null) => void;
  onRegionCreated: (region: Region) => void;
  activeTool: ToolType;
  textPreviewEnabled: boolean;
  compareModeEnabled: boolean;
  zoomLevel: number;
  theme?: 'light' | 'dark';
}

export const Canvas: React.FC<CanvasProps> = ({
  activePageId,
  customImageUrl,
  regions,
  selectedRegionId,
  onRegionSelected,
  onRegionCreated,
  activeTool,
  textPreviewEnabled,
  compareModeEnabled,
  zoomLevel,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [brushPaths, setBrushPaths] = useState<Array<{ id: string; x: number; y: number; r: number }>>([]);
  const [isBrushing, setIsBrushing] = useState(false);

  // Clear simulated brush paths when page changes
  useEffect(() => {
    setBrushPaths([]);
  }, [activePageId]);

  // Translate client coordinates (pixels) to parent canvas container (percentages)
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    
    // Scale position depending on current scroll/zoom viewport dimensions
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    // Clamp to boundaries
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Left click check
    if (e.button !== 0) return;

    if (activeTool === 'draw') {
      const coords = getRelativeCoords(e.clientX, e.clientY);
      setIsDrawing(true);
      setStartPos(coords);
      setCurrentPos(coords);
    } else if (activeTool === 'brush') {
      setIsBrushing(true);
      addBrushPoint(e.clientX, e.clientY);
    } else if (activeTool === 'pan') {
      // Simulate click selection overlay for panning
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'draw' && isDrawing) {
      const coords = getRelativeCoords(e.clientX, e.clientY);
      setCurrentPos(coords);
    } else if (activeTool === 'brush' && isBrushing) {
      addBrushPoint(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'draw' && isDrawing) {
      setIsDrawing(false);
      const endCoords = getRelativeCoords(e.clientX, e.clientY);
      
      const x = Math.min(startPos.x, endCoords.x);
      const y = Math.min(startPos.y, endCoords.y);
      const width = Math.abs(startPos.x - endCoords.x);
      const height = Math.abs(startPos.y - endCoords.y);

      // Avoid creating tiny noise boxes
      if (width > 2 && height > 2) {
        const newRegion: Region = {
          id: `manual_reg_${Date.now()}`,
          box: { x, y, width, height },
          type: 'bubble',
          ocrText: '[Manual Region Drawn — Input original text or translation]',
          translatedText: '',
          font: 'Comic Neue',
          fontSize: 'auto',
          align: 'center',
          isHidden: false,
          isApplied: false
        };
        onRegionCreated(newRegion);
      }
    } else if (activeTool === 'brush') {
      setIsBrushing(false);
    }
  };

  const addBrushPoint = (clientX: number, clientY: number) => {
    const coords = getRelativeCoords(clientX, clientY);
    setBrushPaths((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        x: coords.x,
        y: coords.y,
        r: 3 // radius size percentage
      }
    ]);
  };

  // Determine border and fill states depending on Region Type and Applied states
  const getRegionStyle = (region: Region) => {
    const isSelected = region.id === selectedRegionId;
    const isApplied = region.isApplied;
    const isHidden = region.isHidden;

    if (isHidden) {
      return {
        borderClass: isSelected ? 'border-2 border-gray-400 border-dashed animate-pulse' : 'border border-dashed border-gray-300',
        bgClass: isSelected ? 'bg-gray-100/40' : 'bg-gray-50/20',
        labelColor: 'bg-gray-400 text-white'
      };
    }

    if (isApplied) {
      return {
        borderClass: isSelected ? 'border-2 border-emerald-500 shadow-sm' : 'border border-emerald-500/40',
        bgClass: isSelected ? 'bg-emerald-500/10' : 'bg-emerald-500/5',
        labelColor: 'bg-emerald-600 text-white'
      };
    }

    if (isSelected) {
      return {
        borderClass: 'border-2 border-blue-500 ring-4 ring-blue-500/10 shadow-sm scale-[1.002]',
        bgClass: 'bg-blue-500/10',
        labelColor: 'bg-blue-600 text-white font-semibold'
      };
    }

    // Default types
    switch (region.type) {
      case 'sfx':
        return {
          borderClass: 'border border-amber-500 hover:border-amber-600 hover:scale-[1.001]',
          bgClass: 'bg-amber-500/5 hover:bg-amber-500/10',
          labelColor: 'bg-amber-600 text-white font-medium'
        };
      case 'narrator':
        return {
          borderClass: 'border border-emerald-500 hover:border-emerald-600 hover:scale-[1.001]',
          bgClass: 'bg-emerald-500/5 hover:bg-emerald-500/10',
          labelColor: 'bg-emerald-600 text-white'
        };
      case 'author_note':
        return {
          borderClass: 'border border-teal-500 hover:border-teal-600 hover:scale-[1.001]',
          bgClass: 'bg-teal-500/5 hover:bg-teal-500/10',
          labelColor: 'bg-teal-600 text-white'
        };
      case 'title':
        return {
          borderClass: 'border border-rose-500 hover:border-rose-400 hover:scale-[1.001]',
          bgClass: 'bg-rose-500/5 hover:bg-rose-500/10',
          labelColor: 'bg-rose-600 text-white font-bold'
        };
      default: // bubble
        return {
          borderClass: 'border border-blue-500 hover:border-blue-600 hover:scale-[1.001]',
          bgClass: 'bg-blue-500/5 hover:bg-blue-500/10',
          labelColor: 'bg-blue-600 text-white'
        };
    }
  };

  // Pre-configured bubble masking backgrounds depending on region type
  // This simulates the LaMa inpainting mask block coverage!
  const getInpaintMaskStyle = (type: string) => {
    switch (type) {
      case 'narrator':
        return 'bg-amber-50 border border-amber-200'; // typical yellow narrator boxes
      case 'sfx':
        return 'bg-transparent'; // SFX usually overlay transparently, or blend
      default:
        return 'bg-white border border-gray-300 rounded-full shadow-sm'; // regular manga speech bubble
    }
  };

  return (
    <div
      id="canvas-container-outer"
      className={`flex-1 p-6 flex items-center justify-center overflow-auto relative transition-colors duration-200 ${
        theme === 'dark' ? 'bg-stone-900' : 'bg-[#F3F4F6]'
      }`}
    >
      
      {/* Zoom scale wrapper */}
      <div
        id="canvas-scaler"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`relative max-w-full aspect-[3/4] bg-white shadow-2xl transition-transform duration-200 ${
          activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
        style={{
          width: '560px',
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
          userSelect: 'none'
        }}
      >
        {/* Core background page content */}
        {compareModeEnabled ? (
          // BEFORE view: Render raw original panels
          customImageUrl ? (
            <img
              id="raw-comic-image-compare"
              src={customImageUrl}
              alt="Raw Comic page"
              className="w-full h-full object-contain bg-white pointer-events-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ComicPanels pageId={activePageId} />
          )
        ) : (
          // AFTER / EDITING view: With fully live layers
          <>
            {customImageUrl ? (
              <img
                id="raw-comic-image"
                src={customImageUrl}
                alt="Comic page"
                className="w-full h-full object-contain bg-white pointer-events-none"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ComicPanels pageId={activePageId} />
            )}

            {/* Visual simulation of inpaint brushing */}
            {brushPaths.map((pt) => (
              <div
                key={pt.id}
                className="absolute bg-white rounded-full pointer-events-none opacity-90 blur-[1px]"
                style={{
                  left: `${pt.x}%`,
                  top: `${pt.y}%`,
                  width: `${pt.r * 2}%`,
                  height: `${pt.r * 2.5}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 4px #ffffff'
                }}
              />
            ))}

            {/* Non-destructive Inpainted Overlay Layer */}
            {regions.map((region) => {
              const isApplied = region.isApplied;
              const isHidden = region.isHidden;
              const shouldRenderInpaintMask = (textPreviewEnabled || isApplied) && !isHidden;

              if (!shouldRenderInpaintMask) return null;

              return (
                <div
                  key={`inpaint-mask-${region.id}`}
                  className={`absolute flex items-center justify-center p-2 text-center pointer-events-none overflow-hidden ${getInpaintMaskStyle(
                    region.type
                  )}`}
                  style={{
                    left: `${region.box.x}%`,
                    top: `${region.box.y}%`,
                    width: `${region.box.width}%`,
                    height: `${region.box.height}%`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: region.font && region.font !== 'Inherit' ? region.font : 'Comic Neue, sans-serif',
                      fontSize: region.fontSize === 'auto' ? 'calc(5px + 0.8vw)' : `${region.fontSize}px`,
                      textAlign: region.align || 'center',
                      lineHeight: '1.15',
                      fontWeight: region.type === 'title' ? '900' : 'bold',
                      color: region.type === 'sfx' ? '#ef4444' : '#111827', // red for translated sound effect, dark charcoal for core dialogue bubbles
                      textShadow: region.type === 'sfx' ? '1px 1px 0 #fff, -1px -1px 0 #fff' : 'none'
                    }}
                    className="w-full font-sans select-none tracking-tight leading-tight uppercase scale-95"
                  >
                    {region.translatedText || region.ocrText}
                  </span>
                </div>
              );
            })}

            {/* Detection / Edit Box Grid Overlay */}
            {regions.map((region) => {
              const style = getRegionStyle(region);
              const isSelected = region.id === selectedRegionId;

              return (
                <div
                  key={region.id}
                  id={`canvas-region-${region.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select' || activeTool === 'draw') {
                      onRegionSelected(region.id);
                    }
                  }}
                  className={`absolute transition-all cursor-pointer group ${style.borderClass} ${style.bgClass}`}
                  style={{
                    left: `${region.box.x}%`,
                    top: `${region.box.y}%`,
                    width: `${region.box.width}%`,
                    height: `${region.box.height}%`,
                  }}
                >
                  {/* Bounding box type text tag bar */}
                  <div
                    className={`absolute top-0 left-0 text-[8px] font-mono font-bold uppercase py-0.5 px-1 truncate pointer-events-none flex items-center gap-1 ${style.labelColor}`}
                    style={{ transform: 'translateY(-100%)' }}
                  >
                    <span>{region.type}</span>
                    {region.isApplied && <span>✓ Applied</span>}
                    {region.isHidden && <span className="opacity-75">[Hidden]</span>}
                  </div>

                  {/* Highlighting handles for active selections */}
                  {isSelected && (
                    <>
                      <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-blue-600 border border-white -translate-x-1/2 -translate-y-1/2"></div>
                      <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-600 border border-white translate-x-1/2 -translate-y-1/2"></div>
                      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-blue-600 border border-white -translate-x-1/2 translate-y-1/2"></div>
                      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-blue-600 border border-white translate-x-1/2 translate-y-1/2"></div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Active Drawing Box visualization */}
            {activeTool === 'draw' && isDrawing && (
              <div
                className="absolute border border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                style={{
                  left: `${Math.min(startPos.x, currentPos.x)}%`,
                  top: `${Math.min(startPos.y, currentPos.y)}%`,
                  width: `${Math.abs(startPos.x - currentPos.x)}%`,
                  height: `${Math.abs(startPos.y - currentPos.y)}%`,
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Floating Mode Indicator Label */}
      <div className={`absolute top-4 left-4 text-[10px] px-3 py-1.5 font-mono rounded-full flex items-center gap-2 backdrop-blur-md select-none pointer-events-none shadow-sm border transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-stone-950/90 border-stone-800 text-stone-300'
          : 'bg-white/90 border-gray-200 text-gray-700'
      }`}>
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
        <span>WORKSPACE: {activeTool.toUpperCase()} MODE</span>
        {compareModeEnabled && <span className="text-blue-600 font-bold ml-1">● COMPARING RAW</span>}
        {textPreviewEnabled && <span className="text-green-650 font-bold ml-1">● TRANSLATED</span>}
      </div>
    </div>
  );
};
