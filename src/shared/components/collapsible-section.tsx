import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface CollapsibleSectionProps {
  title: string;
  isDefaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  storageKey?: string; // Optional storage key to persist state
  headerAction?: React.ReactNode; // Optional action button on the right
}

export function CollapsibleSection({
  title,
  isDefaultOpen = true,
  children,
  className,
  headerClassName,
  storageKey,
  headerAction,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(isDefaultOpen);

  // Load saved state on mount
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`collapsible-${storageKey}`);
      if (saved !== null) {
        setIsOpen(saved === 'true');
      }
    }
  }, [storageKey]);

  // Save state when changed
  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    if (storageKey) {
      localStorage.setItem(`collapsible-${storageKey}`, newState.toString());
    }
  };

  return (
    <div className={cn("", className)}>
      <div
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors",
          headerClassName
        )}
      >
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 flex-1 focus:outline-none"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
          )}
          <span className="uppercase tracking-wide">{title}</span>
        </button>
        {headerAction && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>
      <div className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out",
        isOpen ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="max-h-[inherit] overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}