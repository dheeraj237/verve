export type FileNode = {
  id: string;
  type: 'file' | 'directory';
  name: string;
  path: string;
  parentId?: string | null;
  children?: string[];
  size?: number;
  modifiedAt?: string;
  createdAt?: string;
  dirty?: boolean;
  synced?: boolean;
  isSynced?: boolean;
  version?: number;
  mimeType?: string;
  meta?: Record<string, any>;
};

const KNOWN_KEYS = new Set([
  'id',
  '_id',
  'type',
  'name',
  'path',
  'parentId',
  'children',
  'size',
  'modifiedAt',
  'createdAt',
  'dirty',
  'synced',
  'isSynced',
  'version',
  'mimeType',
]);

function toISODate(value: any): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function normalizeToFileNode(raw: Record<string, any>): FileNode {
  const id = raw.id !== undefined ? raw.id : raw._id !== undefined ? raw._id : (raw.path !== undefined ? String(raw.path) : '');

  const hasChildren = Array.isArray(raw.children) && raw.children.length > 0;
  let type: 'file' | 'directory';
  if (raw.type === 'directory') type = 'directory';
  else if (raw.type === 'file') type = 'file';
  else type = hasChildren ? 'directory' : 'file';

  const path = raw.path !== undefined ? String(raw.path) : '';
  const name = raw.name !== undefined ? String(raw.name) : (path ? String(path).split('/').filter(Boolean).pop() || '' : '');

  const node: FileNode = {
    id: String(id),
    type,
    name: String(name),
    path: String(path),
    parentId: raw.parentId !== undefined ? raw.parentId : null,
    size: raw.size !== undefined ? Number(raw.size) : undefined,
    modifiedAt: toISODate(raw.modifiedAt),
    createdAt: toISODate(raw.createdAt),
    dirty: raw.dirty === true,
    // Prefer explicit `isSynced`, fall back to legacy `synced` field
    isSynced: raw.isSynced !== undefined ? raw.isSynced : (raw.synced === false ? false : true),
    version: raw.version !== undefined ? Number(raw.version) : undefined,
    mimeType: raw.mimeType !== undefined ? raw.mimeType : undefined,
    meta: {},
  };

  if (type === 'directory') {
    node.children = Array.isArray(raw.children) ? raw.children.map((c: any) => String(c)) : [];
  }

  // preserve unknown fields in meta
  const meta: Record<string, any> = {};
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      meta[key] = raw[key];
    }
  }
  if (Object.keys(meta).length > 0) node.meta = meta;

  // remove empty meta
  if (node.meta && Object.keys(node.meta).length === 0) delete node.meta;

  // for files, ensure children is not present
  if (node.type === 'file' && 'children' in node) delete node.children;

  return node;
}

export default normalizeToFileNode;
