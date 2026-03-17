import { create } from 'zustand';

interface LoadingStore {
  isLoading: boolean;
  message: string | null;
  show: (message?: string) => void;
  hide: () => void;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  isLoading: false,
  message: null,
  show: (message) => set({ isLoading: true, message: message || null }),
  hide: () => set({ isLoading: false, message: null }),
}));

export default useLoadingStore;
