/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EngineRegion } from '../engine';
import type { Region, RegionType } from '../types';

const REGION_TYPES: readonly RegionType[] = ['bubble', 'sfx', 'narrator', 'author_note', 'title'];

/** Typography defaults, by what the region is. */
const FONT_BY_TYPE: Record<RegionType, string> = {
  bubble: 'Comic Neue',
  narrator: 'Comic Neue',
  sfx: 'Bangers',
  author_note: 'Architects Daughter',
  title: 'Cinzel',
};

/**
 * An engine reports what it found: a box, a type, the original text and a
 * translation. It says nothing about how the text should be set, because that
 * is the user's business -- so the presentation fields `Region` requires are
 * filled in here, once, instead of being left undefined for the interface to
 * trip over.
 */
export function toRegion(found: EngineRegion, index = 0): Region {
  const type = REGION_TYPES.includes(found.type) ? found.type : 'bubble';
  return {
    id: found.id || `reg_${Date.now().toString(36)}_${index}`,
    box: clampBox(found.box),
    type,
    ocrText: found.ocrText ?? '',
    translatedText: found.translatedText ?? '',
    font: FONT_BY_TYPE[type],
    fontSize: 'auto',
    align: 'center',
    isHidden: false,
    // Nothing is applied until the user approves it. That is the whole point
    // of the review step, so it must default to false.
    isApplied: false,
  };
}

export function toRegions(found: EngineRegion[]): Region[] {
  return found.map(toRegion);
}

/** A model can report a box that runs off the page; keep it on it. */
function clampBox(box: Region['box']): Region['box'] {
  const x = clamp(box?.x ?? 0, 0, 100);
  const y = clamp(box?.y ?? 0, 0, 100);
  return {
    x,
    y,
    width: clamp(box?.width ?? 0, 0.5, 100 - x),
    height: clamp(box?.height ?? 0, 0.5, 100 - y),
  };
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}
