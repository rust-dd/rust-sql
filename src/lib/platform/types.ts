export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface SaveFileOptions {
  defaultName: string;
  content: string;
  mime?: string;
  filters?: FileFilter[];
}

export interface OpenFileOptions {
  filters?: FileFilter[];
}

export type OpenFileResult =
  | { kind: "path"; path: string }
  | { kind: "file"; file: File };

export interface Dialog {
  saveFile(opts: SaveFileOptions): Promise<boolean>;
  openFile(opts: OpenFileOptions): Promise<OpenFileResult | null>;
}

export interface Updater {
  checkForUpdates(): Promise<void>;
  startBackgroundUpdateCheck(): void;
}
