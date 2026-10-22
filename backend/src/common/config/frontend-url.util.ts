/**
 * Extracts the primary frontend origin from FRONTEND_URL.
 * Supports comma-separated origin strings (used in CORS settings)
 * and strips any trailing slash.
 */
export function getPrimaryFrontendUrl(rawUrl?: string | null): string {
  if (!rawUrl) {
    return 'http://localhost:5173';
  }

  const primary = rawUrl.split(',')[0].trim();
  return (primary || 'http://localhost:5173').replace(/\/+$/, '');
}
