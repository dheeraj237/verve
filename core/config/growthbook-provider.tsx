/**
 * GrowthBook Provider - Stub for demo mode
 * Originally used for feature flags
 */
import { ReactNode } from "react";

interface GrowthBookWrapperProps {
  children: ReactNode;
}

export function GrowthBookWrapper({ children }: GrowthBookWrapperProps) {
  // Demo mode - no feature flags needed
  return <>{children}</>;
}
