/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The File System Access API is not in TypeScript's DOM library yet. Only the
 * parts this app calls are declared.
 */
interface FileSystemWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileHandle {
  createWritable(): Promise<FileSystemWritable>;
}
export interface DirectoryHandle {
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
}
type DirectoryPicker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle>;

function directoryPicker(): DirectoryPicker | undefined {
  return (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
}

/** True where the app can write into a folder the user chose. */
export function supportsDirectoryOutput(): boolean {
  return typeof directoryPicker() === 'function';
}

/**
 * One run of work: the pages from a single upload, going into a single folder.
 * Pages are handed over as they are approved, never collected up and zipped.
 */
export interface OutputSession {
  readonly kind: 'directory' | 'download';
  /** The folder pages land in, real or, for downloads, notional. */
  readonly folderName: string;
  /** Names written so far, in order. */
  readonly written: readonly string[];
  write(fileName: string, blob: Blob): Promise<void>;
}

/**
 * Asks the user for the folder to keep results in. Must be called from a
 * click or key press: browsers refuse the picker otherwise.
 */
export async function pickOutputRoot(): Promise<DirectoryHandle> {
  const picker = directoryPicker();
  if (!picker) {
    throw new Error('This browser cannot write into a folder you choose. Pages will download one by one instead.');
  }
  return picker({ mode: 'readwrite' });
}

class DirectorySession implements OutputSession {
  readonly kind = 'directory' as const;
  readonly written: string[] = [];

  constructor(
    readonly folderName: string,
    private readonly folder: DirectoryHandle,
  ) {}

  async write(fileName: string, blob: Blob): Promise<void> {
    const handle = await this.folder.getFileHandle(fileName, { create: true });
    const stream = await handle.createWritable();
    try {
      await stream.write(blob);
    } finally {
      await stream.close();
    }
    this.written.push(fileName);
  }
}

class DownloadSession implements OutputSession {
  readonly kind = 'download' as const;
  readonly written: string[] = [];

  constructor(readonly folderName: string) {}

  async write(fileName: string, blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Give the browser a tick to start the transfer before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    this.written.push(fileName);
  }
}

/**
 * Opens a session under `root`, creating `Results/<folderName>/`. Without a
 * root -- no picker, or the user declined -- pages download individually and
 * the folder name only shapes the file names.
 */
export async function openOutputSession(
  folderName: string,
  root?: DirectoryHandle,
  resultsFolder = 'Results',
): Promise<OutputSession> {
  if (!root) return new DownloadSession(folderName);
  const results = await root.getDirectoryHandle(resultsFolder, { create: true });
  const folder = await results.getDirectoryHandle(folderName, { create: true });
  return new DirectorySession(folderName, folder);
}
