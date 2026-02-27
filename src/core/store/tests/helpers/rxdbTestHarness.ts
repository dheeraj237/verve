type RxDoc = { id: string; path: string; content: string; isDir?: boolean; children?: string[] };

export function createRxdbTestHarness() {
  const store = new Map<string, RxDoc>();

  return {
    insert: async (doc: RxDoc) => {
      store.set(doc.id, doc);
      return doc;
    },
    findByPath: async (path: string) => {
      for (const v of store.values()) {
        if (v.path === path) return v;
      }
      return null;
    },
    queryAll: async (): Promise<RxDoc[]> => {
      return Array.from(store.values());
    },
    removeById: async (id: string) => {
      return store.delete(id);
    },
    clear: async () => {
      store.clear();
    },
    getState: () => store,
  };
}
