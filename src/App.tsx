import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/shared/components/theme-provider';
import { GrowthBookWrapper } from '@/core/config/growthbook-provider';
import { Toaster } from '@/shared/components/toaster';
import { AppLoader } from '@/shared/components/app-loader';
import { SyncIndicator } from '@/shared/components/sync-indicator';
import { PatchFetchClient } from '@/core/init/patch-fetch-client';
import { LandingPage } from '@/shared/components/landing-page';
import { EditorPage } from '@/pages/EditorPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useBrowserMode } from '@/hooks/use-browser-mode';

function App() {
  // Initialize browser/demo mode
  const { isInitialized, error } = useBrowserMode();

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-destructive">Initialization Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <GrowthBookWrapper>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        storageKey="theme"
      >
        <AppLoader />
        <SyncIndicator />
        <PatchFetchClient />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        <Toaster />
      </ThemeProvider>
    </GrowthBookWrapper>
  );
}

export default App;
