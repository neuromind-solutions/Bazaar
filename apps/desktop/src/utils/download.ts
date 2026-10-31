/**
 * Cross-browser reliable blob downloader for desktop & mobile web.
 * Uses a delayed URL revocation so Chromium / WebKit does not drop the filename & extension.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename);
  link.setAttribute('rel', 'noopener noreferrer');
  document.body.appendChild(link);
  link.click();

  // Keep Blob URL alive for 10 seconds so the browser download manager can safely read metadata
  setTimeout(() => {
    try {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup error
    }
  }, 10000);
}
