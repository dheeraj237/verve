/**
 * Demo Adapter V2 - Uses localStorage to store demo files
 */

import { WorkspaceAdapter, WorkspaceType, FileData, FileMetadata, AdapterCapabilities } from '../types';
import { FileSystemError, FileErrorType } from '../errors';
import { STORAGE_KEYS } from '../constants';

interface StoredFile {
  id: string;
  path: string;
  name: string;
  content: string;
  size: number;
  lastModified: string;
  version: string;
  category: string;
}

/**
 * Demo adapter that stores files in browser localStorage
 */
export class DemoAdapterV2 implements WorkspaceAdapter {
  type = WorkspaceType.DEMO;
  capabilities: AdapterCapabilities = {
    supportsWatch: false,
    supportsBatch: false,
    supportsVersioning: true,
    supportsRename: true,
    supportsDirectories: false,
    maxFileSize: 5 * 1024 * 1024, // 5MB
  };

  private files = new Map<string, StoredFile>();
  private initialized = false;

  private sampleFiles = [
    { path: '/01-basic-formatting.md', category: 'samples' },
    { path: '/02-lists-and-tasks.md', category: 'samples' },
    { path: '/03-code-blocks.md', category: 'samples' },
    { path: '/04-tables-and-quotes.md', category: 'samples' },
    { path: '/05-collapsable-sections.md', category: 'samples' },
    { path: '/06-mermaid-diagrams.md', category: 'samples' },
    { path: '/07-advanced-features.md', category: 'samples' },
    { path: '/08-link-navigation.md', category: 'samples' },
    { path: '/content1/test-feature-link-navigation.md', category: 'content1' },
    { path: '/notes-101/notes.md', category: 'notes-101' },
  ];

  /**
   * Initialize adapter and load sample files
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadSampleFiles();
    this.loadFromStorage();
    this.initialized = true;
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<FileData> {
    await this.initialize();

    const file = this.files.get(path);
    if (!file) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        path,
        `File not found: ${path}`
      );
    }

    return {
      id: file.id,
      path: file.path,
      name: file.name,
      category: file.category,
      content: file.content,
      size: file.size,
      lastModified: new Date(file.lastModified),
      version: file.version,
    };
  }

  /**
   * Write a file
   */
  async writeFile(path: string, content: string, version?: string): Promise<void> {
    await this.initialize();

    const existing = this.files.get(path);
    
    if (existing && version && existing.version !== version) {
      throw new FileSystemError(
        FileErrorType.CONFLICT,
        path,
        'Version conflict detected'
      );
    }

    const now = new Date().toISOString();
    const file: StoredFile = {
      id: existing?.id || path,
      path,
      name: this.getFileName(path),
      content,
      size: content.length,
      lastModified: now,
      version: now,
      category: existing?.category || this.getCategoryFromPath(path),
    };

    this.files.set(path, file);
    this.saveToStorage();
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    await this.initialize();

    if (!this.files.has(path)) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        path,
        `File not found: ${path}`
      );
    }

    this.files.delete(path);
    this.saveToStorage();
  }

  /**
   * List files in a directory
   */
  async listFiles(directory = ''): Promise<FileMetadata[]> {
    await this.initialize();

    const normalizedDir = directory.startsWith('/') ? directory.slice(1) : directory;
    
    return Array.from(this.files.values())
      .filter(file => {
        if (!normalizedDir) return true;
        const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        return filePath.startsWith(normalizedDir);
      })
      .map(file => ({
        id: file.id,
        path: file.path,
        name: file.name,
        category: file.category,
        size: file.size,
        lastModified: new Date(file.lastModified),
      }));
  }

  /**
   * Rename a file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await this.initialize();

    const file = this.files.get(oldPath);
    if (!file) {
      throw new FileSystemError(
        FileErrorType.NOT_FOUND,
        oldPath,
        `File not found: ${oldPath}`
      );
    }

    this.files.delete(oldPath);
    this.files.set(newPath, {
      ...file,
      path: newPath,
      name: this.getFileName(newPath),
    });
    
    this.saveToStorage();
  }

  /**
   * Get file version
   */
  async getFileVersion(path: string): Promise<string | undefined> {
    await this.initialize();
    return this.files.get(path)?.version;
  }

  /**
   * Load sample files from public/content directory
   */
  private async loadSampleFiles(): Promise<void> {
    for (const sample of this.sampleFiles) {
      try {
        const response = await fetch(`/content${sample.path}`);
        if (response.ok) {
          const content = await response.text();
          const now = new Date().toISOString();
          
          this.files.set(sample.path, {
            id: sample.path,
            path: sample.path,
            name: this.getFileName(sample.path),
            content,
            size: content.length,
            lastModified: now,
            version: now,
            category: sample.category,
          });
        }
      } catch (error) {
        console.warn(`Failed to load sample file ${sample.path}:`, error);
      }
    }
  }

  /**
   * Load files from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.demoFiles);
      if (stored) {
        const files: StoredFile[] = JSON.parse(stored);
        files.forEach(file => this.files.set(file.path, file));
      }
    } catch (error) {
      console.error('Failed to load demo files from storage:', error);
    }
  }

  /**
   * Save files to localStorage
   */
  private saveToStorage(): void {
    try {
      const files = Array.from(this.files.values());
      localStorage.setItem(STORAGE_KEYS.demoFiles, JSON.stringify(files));
    } catch (error) {
      console.error('Failed to save demo files to storage:', error);
    }
  }

  /**
   * Extract filename from path
   */
  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  /**
   * Get category from path
   */
  private getCategoryFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'root';
  }
}
