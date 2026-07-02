/**
 * Security utilities: XSS prevention, origin validation, safe data handling.
 */

/**
 * Sanitize user-provided strings for safe display in extension UI.
 * Never use innerHTML with unsanitized data.
 */
export function sanitizeText(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validate that a URL's origin matches the expected origin (for message passing).
 */
export function isValidOrigin(url: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === expectedOrigin;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is safe to navigate to (no javascript: or data: URLs).
 */
export function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('ftp://') ||
    lower.startsWith('mailto:');
}

/**
 * Validate that a message sender matches the extension's own origin.
 */
export function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id && sender.id !== chrome.runtime.id) return false;
  // For content scripts, verify the sender tab's URL
  if (sender.url) {
    try {
      const url = new URL(sender.url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:' && !url.protocol.startsWith('chrome')) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Maximum size for content to process (prevents OOM).
 */
export function truncateContent(content: string, maxBytes = 5 * 1024 * 1024): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  if (bytes.length <= maxBytes) return content;

  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes.slice(0, maxBytes));
}
