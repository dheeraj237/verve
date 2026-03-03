import type { FileData } from './file-manager';
import * as fileOps from './file-manager';

export interface IFileRepository {
  loadFile(path: string, workspaceType?: any, workspaceId?: string): Promise<any>;
  saveFile(path: string, content: string, workspaceType?: any, metadata?: Record<string, any>, workspaceId?: string): Promise<any>;
  listFiles?(dirPath?: string, workspaceId?: string): Promise<any[]>;
}

const defaultRepo: IFileRepository = {
  loadFile: (path, workspaceType, workspaceId) => fileOps.loadFile(path, workspaceType, workspaceId),
  saveFile: (path, content, workspaceType, metadata, workspaceId) => fileOps.saveFile(path, content, workspaceType, metadata, workspaceId),
  listFiles: (dirPath, workspaceId) => fileOps.listFiles(dirPath, workspaceId),
};

let repo: IFileRepository = defaultRepo;

export function setFileRepo(r: IFileRepository) {
  repo = r;
}

export const fileRepo = {
  loadFile: (path: string, workspaceType?: any, workspaceId?: string) => repo.loadFile(path, workspaceType, workspaceId),
  saveFile: (path: string, content: string, workspaceType?: any, metadata?: Record<string, any>, workspaceId?: string) => repo.saveFile(path, content, workspaceType, metadata, workspaceId),
  listFiles: (dirPath?: string, workspaceId?: string) => repo.listFiles ? repo.listFiles(dirPath, workspaceId) : Promise.resolve([]),
};

export default fileRepo;
