import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "text-sm font-medium",
          description: "text-sm",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          closeButton: "bg-background border-border",
        },
      }}
    />
  );
}
