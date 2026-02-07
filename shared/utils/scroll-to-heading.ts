/**
 * Shared utility for scrolling to headings by ID or anchor
 * Used by TOC, anchor links, and cross-file navigation
 */

/**
 * Scroll to a heading by its ID
 * Works in both preview mode (scrolls container) and live editor mode (dispatches event)
 * 
 * @param headingId - The heading ID (without # prefix)
 * @returns true if heading was found and scrolled to, false otherwise
 */
export function scrollToHeading(headingId: string): boolean {
  if (!headingId) return false;

  // Remove leading # if present
  const cleanId = headingId.startsWith('#') ? headingId.slice(1) : headingId;

  // Get the heading element and container
  const element = document.getElementById(cleanId);
  const container = document.getElementById("markdown-content");

  // Check if we're in preview mode (elements exist) or live editor mode (elements don't exist)
  if (element && container) {
    // Preview mode - scroll using DOM elements (same as TOC)
    const elementTop = element.offsetTop;
    const containerHeight = container.clientHeight;
    const contentHeight = container.scrollHeight;
    
    // Calculate if we can scroll to top
    const maxScroll = contentHeight - containerHeight;
    const targetScroll = elementTop - 100; // 100px offset from top
    
    if (targetScroll <= maxScroll) {
      container.scrollTo({
        top: targetScroll,
        behavior: "smooth"
      });
    } else {
      container.scrollTo({
        top: maxScroll,
        behavior: "smooth"
      });
    }

    return true;
  } else if (element) {
    // Fallback: element exists but no container (shouldn't happen but handle it)
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  } else {
    // Live editor mode - dispatch custom event
    const event = new CustomEvent('toc-click', {
      detail: { headingId: cleanId },
      bubbles: true
    });
    window.dispatchEvent(event);
    return true; // Assume it worked
  }
}
