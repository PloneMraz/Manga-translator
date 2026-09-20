/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export { renderTranslatedPage } from './renderPage';
export type { RenderOptions, RenderResult } from './renderPage';
export {
  openOutputSession,
  pickOutputRoot,
  supportsDirectoryOutput,
} from './destination';
export type { DirectoryHandle, OutputSession } from './destination';

/** Characters that are trouble in a file name on some platform or other. */
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]+/g;

export function safeName(value: string, fallback = 'page'): string {
  const cleaned = value.replace(UNSAFE, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  return cleaned.slice(0, 80) || fallback;
}

function stripExtension(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,6}$/, '');
}

/**
 * The folder for one run of work. Named after what the user brought in where
 * there is a name to use, and after the date otherwise.
 */
export function outputFolderName(inputName?: string, now: Date = new Date()): string {
  if (inputName?.trim()) {
    return `${safeName(stripExtension(inputName), 'input')}-translated`;
  }
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `output-${yyyy}${mm}${dd}`;
}

/**
 * Page file names carry their position so the folder sorts in reading order,
 * and keep the original name so a page can be traced back to its source.
 */
export function pageFileName(index: number, originalName?: string, extension = 'png'): string {
  const ordinal = String(index + 1).padStart(3, '0');
  const base = originalName?.trim() ? safeName(stripExtension(originalName)) : 'page';
  return `${ordinal}-${base}.${extension}`;
}
