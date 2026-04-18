// R2 upload bridge. Posts a compressed blob to the srtd-r2-upload
// Worker and returns the public R2 URL on success.
//
// Worker endpoint:
//   https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev
// Secret header:
//   X-Upload-Secret: srtd2026xK9mN3pQ
// Response:
//   { url: 'https://pub-6a2a4aa8073d454ab9aeee69ef841635.r2.dev/filename' }

const R2_UPLOAD_URL = 'https://srtd-r2-upload.ksg-kumarshubhamgune.workers.dev';
const R2_UPLOAD_SECRET = 'srtd2026xK9mN3pQ';

/**
 * Upload a Blob to R2 and get back the public URL.
 * filename: string (without path prefix)
 * blob: Blob
 * Returns a Promise<string> resolving to the public URL.
 */
export async function uploadToR2(filename, blob) {
  const url = `${R2_UPLOAD_URL}/?filename=${encodeURIComponent(filename)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
      'X-Upload-Secret': R2_UPLOAD_SECRET
    },
    body: blob
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 upload failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (!data || !data.url) {
    throw new Error('R2 upload returned no URL');
  }
  return data.url;
}
