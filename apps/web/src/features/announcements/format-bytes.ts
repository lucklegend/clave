/**
 * A byte count as the design writes it — "412 KB", "2.1 MB".
 *
 * On the 1024 scale, because that is the scale the caps are expressed in: `maxBytesPerFile` is
 * 10485760, so the file someone is told is "10.0 MB" is exactly the file the server accepts.
 *
 * Pure, and shared by the two lists that state a file's size: `AttachmentPicker` for a file that
 * is about to be uploaded, and `AttachmentList` for one already stored. A second copy would let
 * the same file be described two ways on the same page.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  return kilobytes < 1024 ? `${Math.round(kilobytes)} KB` : `${(kilobytes / 1024).toFixed(1)} MB`;
}
