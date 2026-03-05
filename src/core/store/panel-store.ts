/**
 * Panel Store - Manages the collapsed/expanded state of side panels
 * Used in the app shell to control left and right panel visibility
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PanelState {
  // Whether left/right panels are open (true) or closed (false)
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;

  // Toggle actions for UI buttons
  toggleLeft: () => void;
  toggleRight: () => void;
  // Persisted sizes (percentages 0-100) used as defaults
  leftSize: number;
  rightSize: number;
  setLeftSize: (pct: number) => void;
  setRightSize: (pct: number) => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      leftPanelOpen: true,
      rightPanelOpen: true,
      leftSize: 20,
      rightSize: 20,
      setLeftSize: (pct: number) => set({ leftSize: Math.max(0, Math.min(100, Math.round(pct))) }),
      setRightSize: (pct: number) => set({ rightSize: Math.max(0, Math.min(100, Math.round(pct))) }),
      toggleLeft: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
      toggleRight: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
    }),
    {
      name: "panel-storage",
    }
  )
);
