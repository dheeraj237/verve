/**
 * Mobile detection and responsive utilities
 * Centralized module for mobile-specific logic to avoid code duplication
 */

/**
 * Detect if device is mobile based on user agent
 * Supports Android, iOS, and other mobile devices
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Check if device supports touch events
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * Get breakpoint value for responsive design
 * Matches Tailwind breakpoints
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/**
 * Check if viewport width is below a specific breakpoint
 */
export function isScreenSize(breakpoint: keyof typeof BREAKPOINTS): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < BREAKPOINTS[breakpoint];
}

/**
 * Check if device is mobile or tablet (below lg breakpoint)
 */
export function isMobileOrTablet(): boolean {
  return isScreenSize("lg");
}

/**
 * Check if device is small mobile (below sm breakpoint)
 */
export function isSmallMobile(): boolean {
  return isScreenSize("sm");
}

/**
 * Attach click handler that works for both mouse and touch events
 * Handles mousedown and touchstart for immediate response on touch devices
 */
export function onClickOrTouch(
  element: HTMLElement | null,
  handler: (e: MouseEvent | TouchEvent) => void
): () => void {
  if (!element) return () => {};

  const handleMouseDown = (e: MouseEvent) => handler(e);
  const handleTouchStart = (e: TouchEvent) => handler(e);

  element.addEventListener("mousedown", handleMouseDown);
  element.addEventListener("touchstart", handleTouchStart);

  return () => {
    element.removeEventListener("mousedown", handleMouseDown);
    element.removeEventListener("touchstart", handleTouchStart);
  };
}

/**
 * Listen for viewport size changes and execute callback
 */
export function onViewportChange(
  callback: () => void,
  debounceMs = 150
): () => void {
  if (typeof window === "undefined") return () => {};

  let timeoutId: NodeJS.Timeout;
  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, debounceMs);
  };

  window.addEventListener("resize", handleResize);
  return () => {
    clearTimeout(timeoutId);
    window.removeEventListener("resize", handleResize);
  };
}
