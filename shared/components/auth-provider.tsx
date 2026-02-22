/**
 * Auth Provider - Stub for demo mode
 * Originally used NextAuth for authentication
 */
import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Demo mode - no authentication required
  return <>{children}</>;
}
