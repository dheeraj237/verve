import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { ArrowRight, FileText, Zap, Shield } from "lucide-react";
import { useEffect } from "react";
import { toast } from "@/shared/utils/toast";

function useGoogleClientWarning() {
  useEffect(() => {
    const id = import.meta.env.VITE_AUTH_APP_CLIENT_ID;
    if (!id) {
      toast.warning("Google Client ID not configured — Sign in disabled until VITE_AUTH_APP_CLIENT_ID is set.");
    }
  }, []);
}

export function LandingPage() {
  const title = "Verve: Your Markdown Editor";
  const description = "A powerful markdown documentation editor with live preview and intuitive navigation. Try the demo mode with sample files!";
  const showDemoButton = true;

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-semibold text-xl">Verve</span>
          </div>
          <div className="flex items-center gap-2" />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Title & Description */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {description}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            {showDemoButton && (
              <Button size="lg" className="text-lg px-8" asChild>
                <Link to="/editor">
                  Try Demo <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-16">
            <Card className="space-y-3 hover:shadow-lg transition-shadow">
              <div className="p-6 pb-0">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-center">Live Preview</h3>
              </div>
              <div className="px-6 pb-6">
                <p className="text-sm text-muted-foreground text-center">
                  See your markdown rendered instantly as you type with syntax highlighting and
                  Mermaid diagram support.
                </p>
              </div>
            </Card>

            <Card className="space-y-3 hover:shadow-lg transition-shadow">
              <div className="p-6 pb-0">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-center">File Explorer</h3>
              </div>
              <div className="px-6 pb-6">
                <p className="text-sm text-muted-foreground text-center">
                  Navigate through your documentation with an intuitive tree-based file explorer and
                  quick search.
                </p>
              </div>
            </Card>

            <Card className="space-y-3 hover:shadow-lg transition-shadow">
              <div className="p-6 pb-0">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-center">Demo Mode</h3>
              </div>
              <div className="px-6 pb-6">
                <p className="text-sm text-muted-foreground text-center">
                  Try the editor with sample markdown files stored in your browser. All changes are saved locally and reset on page reload.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with React, Vite, TypeScript, and Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}