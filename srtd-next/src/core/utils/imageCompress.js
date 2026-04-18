// Client-side image compression for R2 upload.
// Mirrors the pattern from vanilla 05-api.js: canvas.toBlob
// at quality 0.82, max 1200x1200, saves as JPEG, target < 300KB.
//
// Returns a Promise<Blob>.

export function compressImage(file, options = {}) {
  const maxDim = options.maxDim || 1200;
  const quality = options.quality || 0.82;
  const mimeType = options.mimeType || 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          resolve(blob);
        }, mimeType, quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Generate a deterministic filename for R2. Pattern matches
// vanilla: timestamp-randomSuffix.jpg
export function generateFilename(ext = 'jpg') {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}.${ext}`;
}
