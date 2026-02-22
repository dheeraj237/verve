import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/shared/components/theme-provider';
import { Toaster } from '@/shared/components/toaster';
import { LandingPage } from '@/shared/components/landing-page';
import { EditorPage } from '@/src/pages/EditorPage';
import { useDemoMode } from '@/src/hooks/use-demo-mode';

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
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
