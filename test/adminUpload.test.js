import test from 'node:test';
import assert from 'node:assert/strict';
import { handleUploadError } from '../src/admin/uploadError.js';

test('R2 upload failure restores the upload label and shows an error toast', () => {
  const error = new Error('Storage unavailable');
  const uploadTxt = { textContent: 'Uploading to R2...' };
  const toasts = [];
  const errors = [];

  handleUploadError({
    error,
    uploadTxt,
    previousLabel: 'Upload Image',
    showToast: (...args) => toasts.push(args),
    logError: (...args) => errors.push(args),
  });

  assert.equal(uploadTxt.textContent, 'Upload Image');
  assert.deepEqual(toasts, [['R2 upload failed: Storage unavailable', 'error']]);
  assert.deepEqual(errors, [['Cloudflare R2 upload failed:', error]]);
});
