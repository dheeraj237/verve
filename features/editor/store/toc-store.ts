import { create } from "zustand";

interface TocItem {
  id: string;
  text: string;
  level: number;
  line: number;
}

interface TocState {
  items: TocItem[];
  activeId: string;
  isManualSelection: boolean;
  setItems: (items: TocItem[]) => void;
  setActiveId: (id: string) => void;
  setManualActiveId: (id: string) => void;
  clearManualSelection: () => void;
}

export const useTocStore = create<TocState>((set) => ({
  items: [],
  activeId: "",
  isManualSelection: false,
  setItems: (items) => set({ items }),
  setActiveId: (id) => set({ activeId: id }),
  setManualActiveId: (id) => set({ activeId: id, isManualSelection: true }),
  clearManualSelection: () => set({ isManualSelection: false }),
}));
