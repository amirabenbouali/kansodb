export interface FileAdapter {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, contents: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  ensureDirectory(path: string): Promise<void>;
  syncFile?(path: string): Promise<void>;
  syncDirectory?(path: string): Promise<void>;
}
