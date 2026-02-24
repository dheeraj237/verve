import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/shared/components/theme-provider';
import { GrowthBookWrapper } from '@/core/config/growthbook-provider';
import { Toaster } from '@/shared/components/toaster';
import { WorkspaceLoader } from '@/shared/components/workspace-loader';
import { LandingPage } from '@/shared/components/landing-page';
import { EditorPage } from '@/pages/EditorPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useDemoMode } from '@/hooks/use-demo-mode';

function App() {
  // Initialize demo mode
  const { isInitialized, error } = useDemoMode();

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
          <p className="text-muted-foreground">Loading demo files...</p>
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
        <WorkspaceLoader />
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
