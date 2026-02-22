/**
 * Demo File System Adapter
 * Uses localStorage to store demo files with sample content
 * Reloads fresh demo content on initialization
 */

import { 
  FileSystemAdapter, 
  FileSystemType, 
  FileData, 
  FileMetadata 
} from "../types";

const DEMO_STORAGE_KEY = 'verve-demo-files';
const DEMO_VERSION_KEY = 'verve-demo-version';

interface StoredFile {
  id: string;
  path: string;
  name: string;
  content: string;
  size: number;
  lastModified: string;
  version: string;
  mimeType: string;
  category: string;
}

export class DemoFileSystemAdapter implements FileSystemAdapter {
  type = FileSystemType.LOCAL;
  private files: Map<string, StoredFile> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Sample markdown files to load into demo mode
   */
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

  constructor() {
    // Start initialization but don't wait for it
    this.initPromise = this.initializeDemoFiles();
  }

  /**
   * Ensure initialization is complete before proceeding
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  /**
   * Initialize demo files - always reload fresh content
   */
  private async initializeDemoFiles() {
    if (this.initialized) return;

    // Always start fresh - clear any existing demo files
    localStorage.removeItem(DEMO_STORAGE_KEY);
    
    // Increment version to force reload
    const currentVersion = parseInt(localStorage.getItem(DEMO_VERSION_KEY) || '0');
    localStorage.setItem(DEMO_VERSION_KEY, (currentVersion + 1).toString());

    // Load sample files from public directory
    // Use relative path which works with Vite's base URL
    for (const fileInfo of this.sampleFiles) {
      try {
        const response = await fetch(`content${fileInfo.path}`);
        if (response.ok) {
          const content = await response.text();
          const now = new Date();
          const file: StoredFile = {
            id: `demo-${fileInfo.path}`,
            path: fileInfo.path,
            name: fileInfo.path.split('/').pop() || fileInfo.path,
            content,
            size: content.length,
            lastModified: now.toISOString(),
            version: now.getTime().toString(),
            mimeType: 'text/markdown',
            category: fileInfo.category,
          };
          this.files.set(fileInfo.path, file);
        }
      } catch (error) {
        console.error(`Failed to load demo file ${fileInfo.path}:`, error);
      }
    }

    // Save to localStorage
    this.saveToStorage();
    this.initialized = true;
  }

  /**
   * Save current files to localStorage
   */
  private saveToStorage() {
    const filesArray = Array.from(this.files.values());
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(filesArray));
  }

  /**
   * Load files from localStorage
   */
  private loadFromStorage() {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      try {
        const filesArray: StoredFile[] = JSON.parse(stored);
        this.files.clear();
        filesArray.forEach(file => this.files.set(file.path, file));
      } catch (error) {
        console.error('Failed to load from storage:', error);
      }
    }
  }

  async readFile(path: string): Promise<FileData> {
    await this.ensureInitialized();
    
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
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
      mimeType: file.mimeType,
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureInitialized();
    
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    const now = new Date();
    file.content = content;
    file.size = content.length;
    file.lastModified = now.toISOString();
    file.version = now.getTime().toString();

    this.saveToStorage();
  }

  async getFileVersion(path: string): Promise<string | undefined> {
    await this.ensureInitialized();
    return this.files.get(path)?.version;
  }

  async listFiles(directory: string = '/'): Promise<FileMetadata[]> {
    await this.ensureInitialized();
    
    const files = Array.from(this.files.values())
      .filter(file => {
        if (directory === '/') return !file.path.includes('/', 1);
        return file.path.startsWith(directory) && file.path !== directory;
      })
      .map(file => ({
        id: file.id,
        path: file.path,
        name: file.name,
        category: file.category,
        size: file.size,
        lastModified: new Date(file.lastModified),
        mimeType: file.mimeType,
      }));

    return files;
  }

  async deleteFile(path: string): Promise<void> {
    await this.ensureInitialized();
    
    this.files.delete(path);
    this.saveToStorage();
  }

  async createFile(path: string, content: string = '', category: string = 'demo'): Promise<FileData> {
    await this.ensureInitialized();
    
    if (this.files.has(path)) {
      throw new Error(`File already exists: ${path}`);
    }

    const now = new Date();
    const file: StoredFile = {
      id: `demo-${path}`,
      path,
      name: path.split('/').pop() || path,
      content,
      size: content.length,
      lastModified: now.toISOString(),
      version: now.getTime().toString(),
      mimeType: 'text/markdown',
      category,
    };

    this.files.set(path, file);
    this.saveToStorage();

    return {
      id: file.id,
      path: file.path,
      name: file.name,
      category: file.category,
      content: file.content,
      size: file.size,
      lastModified: new Date(file.lastModified),
      version: file.version,
      mimeType: file.mimeType,
    };
  }

  /**
   * Get all files organized by directory structure
   */
  async getFileTree(): Promise<any> {
    await this.ensureInitialized();
    
    const tree: any = {};
    
    this.files.forEach(file => {
      const parts = file.path.split('/').filter(p => p);
      let current = tree;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      const fileName = parts[parts.length - 1];
      current[fileName] = file;
    });
    
    return tree;
  }

  /**
   * Reset demo to fresh state
   */
  async resetDemo(): Promise<void> {
    this.initialized = false;
    this.files.clear();
    localStorage.removeItem(DEMO_STORAGE_KEY);
    this.initPromise = this.initializeDemoFiles();
    await this.initPromise;
  }
}
