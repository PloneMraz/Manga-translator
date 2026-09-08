/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RegionType = 'bubble' | 'sfx' | 'narrator' | 'author_note' | 'title';
export type ToolType = 'select' | 'draw' | 'lasso' | 'pan' | 'zoom' | 'brush';

export interface BoundingBox {
  x: number;      // 0 to 100 percentage of width
  y: number;      // 0 to 100 percentage of height
  width: number;  // 0 to 100 percentage of width
  height: number; // 0 to 100 percentage of height
}

export interface Region {
  id: string;
  box: BoundingBox;
  type: RegionType;
  ocrText: string;
  translatedText: string;
  font: string;
  fontSize: number | 'auto';
  align: 'left' | 'center' | 'right';
  isHidden: boolean;
  isApplied: boolean;
}

export interface Page {
  id: string;
  name: string;
  imageUrl: string;
  status: 'queued' | 'preloaded' | 'translating' | 'ready' | 'cached' | 'done';
  regions: Region[];
  isComplete: boolean;
  // Hold raw image dimension if known to allow pixel conversions
  width?: number;
  height?: number;
}
