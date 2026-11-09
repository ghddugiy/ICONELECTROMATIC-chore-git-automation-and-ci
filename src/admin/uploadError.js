export function handleUploadError({
  error,
  uploadTxt,
  previousLabel,
  showToast,
  logError = console.error,
}) {
  logError('Cloudflare R2 upload failed:', error);
  if (uploadTxt) uploadTxt.textContent = previousLabel;
  showToast(`R2 upload failed: ${error.message}`, 'error');
}
