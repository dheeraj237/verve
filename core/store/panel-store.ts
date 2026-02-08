import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PanelState {
  leftPanelSize: number;
  rightPanelSize: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  setLeftPanelSize: (size: number) => void;
  setRightPanelSize: (size: number) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  closeLeftPanel: () => void;
  closeRightPanel: () => void;
  openLeftPanel: () => void;
  openRightPanel: () => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      leftPanelSize: 15,
      rightPanelSize: 15,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      setLeftPanelSize: (size) => set({ leftPanelSize: size }),
      setRightPanelSize: (size) => set({ rightPanelSize: size }),
      toggleLeftPanel: () =>
        set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
      toggleRightPanel: () =>
        set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      closeLeftPanel: () => set({ leftPanelCollapsed: true }),
      closeRightPanel: () => set({ rightPanelCollapsed: true }),
      openLeftPanel: () => set({ leftPanelCollapsed: false }),
      openRightPanel: () => set({ rightPanelCollapsed: false }),
    }),
    {
      name: "panel-storage",
    }
  )
);
