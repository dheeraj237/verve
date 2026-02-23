import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserPreferences {
  theme: "light" | "dark" | "system";
  editorFontSize: number;
  editorLineHeight: number;
}

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface UserState {
  profile: UserProfile | null;
  preferences: UserPreferences;
  isLoggedIn: boolean;
  setProfile: (profile: UserProfile | null) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setEditorFontSize: (size: number) => void;
  setEditorLineHeight: (height: number) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      isLoggedIn: false,
      preferences: {
        theme: "system",
        editorFontSize: 14,
        editorLineHeight: 1.5,
      },
      setProfile: (profile) => set({ profile, isLoggedIn: profile !== null }),
      setTheme: (theme) =>
        set((state) => ({
          preferences: { ...state.preferences, theme },
        })),
      setEditorFontSize: (size) =>
        set((state) => ({
          preferences: { ...state.preferences, editorFontSize: size },
        })),
      setEditorLineHeight: (height) =>
        set((state) => ({
          preferences: { ...state.preferences, editorLineHeight: height },
        })),
      updatePreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
      logout: () => set({ profile: null, isLoggedIn: false }),
    }),
    {
      name: "user-storage",
    }
  )
);
