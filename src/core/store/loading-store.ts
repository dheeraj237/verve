import { create } from 'zustand';

interface LoadingStore {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useLoadingStore = create<LoadingStore>((set, get) => ({
  count: 0,
  isLoading: false,
  increment: () => set((s) => {
    const next = s.count + 1;
    return { count: next, isLoading: next > 0 };
  }),
  decrement: () => set((s) => {
    const next = Math.max(0, s.count - 1);
    return { count: next, isLoading: next > 0 };
  }),
  reset: () => set({ count: 0, isLoading: false }),
}));

export default useLoadingStore;
