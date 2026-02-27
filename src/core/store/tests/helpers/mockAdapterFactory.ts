export type MockAdapter = {
  type: string;
  callLog: Array<any>;
  persistFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  listFiles: () => Promise<string[]>;
  getStorage: () => Map<string, string>;
  waitForCall: (predicate: (call: any) => boolean, timeout?: number) => Promise<boolean>;
};

export function createMockAdapter(type = 'browser'): MockAdapter {
  const callLog: any[] = [];
  const storage = new Map<string, string>();

  return {
    type,
    callLog,
    persistFile: async (path: string, content: string) => {
      callLog.push({ op: 'persist', path, content, time: Date.now() });
      storage.set(path, content);
      return Promise.resolve();
    },
    deleteFile: async (path: string) => {
      callLog.push({ op: 'delete', path, time: Date.now() });
      storage.delete(path);
      return Promise.resolve();
    },
    listFiles: async () => {
      callLog.push({ op: 'list', time: Date.now() });
      return Promise.resolve(Array.from(storage.keys()));
    },
    getStorage: () => storage,
    waitForCall: (predicate: (call: any) => boolean, timeout = 2000) =>
      new Promise((resolve, reject) => {
        const start = Date.now();
        const iv = setInterval(() => {
          if (callLog.some(predicate)) {
            clearInterval(iv);
            resolve(true);
          } else if (Date.now() - start > timeout) {
            clearInterval(iv);
            reject(new Error('timeout waiting for adapter call'));
          }
        }, 30);
      }),
  };
}
