import { createRxdbTestHarness } from './rxdbTestHarness';
import { createMockAdapter, MockAdapter } from './mockAdapterFactory';

export type TestEnv = {
  db: ReturnType<typeof createRxdbTestHarness>;
  adapters: Record<string, MockAdapter>;
};

let workspaceCounter = 0;

export function createTestEnv(): TestEnv {
  return {
    db: createRxdbTestHarness(),
    adapters: {},
  };
}

export async function createWorkspace(env: TestEnv, options?: { type?: string; name?: string }) {
  const name = options?.name ?? `ws-${++workspaceCounter}`;
  const type = options?.type ?? 'browser';

  const adapter = createMockAdapter(type);
  env.adapters[name] = adapter;

  const doc = {
    id: `${name}::verve.md`,
    path: 'verve.md',
    content: '# Verve 🚀',
    isDir: false,
  };

  await env.db.insert(doc);

  // Simulate background sync to adapter
  setTimeout(() => {
    adapter.persistFile(doc.path, doc.content).catch(() => {});
  }, 0);

  return { name, adapter, doc };
}

export async function getFile(env: TestEnv, _workspaceName: string, path: string) {
  return env.db.findByPath(path);
}

export async function listFiles(env: TestEnv) {
  return env.db.queryAll();
}

export async function deleteWorkspace(env: TestEnv, name: string) {
  // remove adapter
  delete env.adapters[name];
  // clear DB for simplicity in this harness
  await env.db.clear();
}
