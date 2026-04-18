import React from 'react';
import { Field } from '../../../core/ui/index.js';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';

export function PhotosField() {
  const photos = useFormState(s => s.form.photos);
  const update = useFormState(s => s.update);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = 20 - photos.length;
    const accepted = files.slice(0, remaining);

    // Stage 1: show local previews immediately
    const previews = await Promise.all(accepted.map(f => new Promise((res) => {
      const r = new FileReader();
      r.onload = ev => res({
        name: f.name,
        url: ev.target.result,        // data URL for instant preview
        uploading: true,
        _file: f                       // keep original for compress+upload
      });
      r.readAsDataURL(f);
    })));

    const updatedPhotos = [...photos, ...previews];
    update('photos', updatedPhotos);

    // Stage 2: compress + upload each file, replace data URL with R2 URL
    const { compressImage, generateFilename } = window.SortedReact.utils;
    const { uploadToR2 } = window.SortedReact.bridges;

    for (let i = 0; i < previews.length; i++) {
      const idx = photos.length + i;
      const preview = previews[i];
      try {
        const blob = await compressImage(preview._file, {
          maxDim: 1200,
          quality: 0.82,
          mimeType: 'image/jpeg'
        });
        const filename = generateFilename('jpg');
        const r2Url = await uploadToR2(filename, blob);
        // Read current photos state and replace by index
        const current = useFormState.getState().form.photos.slice();
        if (current[idx]) {
          current[idx] = { name: preview.name, url: r2Url, uploading: false };
          update('photos', current);
        }
      } catch (err) {
        console.error('[photos] upload failed:', err);
        const current = useFormState.getState().form.photos.slice();
        if (current[idx]) {
          current[idx] = { ...current[idx], uploading: false, error: err.message };
          update('photos', current);
        }
      }
    }
  };

  const removePhoto = (idx) => update('photos', photos.filter((_, i) => i !== idx));

  const optional = `Optional · Up to 20 · JPG / PNG${photos.length > 0 ? ` · ${photos.length} added` : ''}`;

  return (
    <Field num="06" name="Photos" optional={optional}>
      {photos.length === 0 ? (
        <label style={{
          display: 'block',
          border: `1px dashed ${tokens.line}`,
          padding: '24px 18px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}>
          <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
          <div style={{ fontFamily: tokens.serif, fontSize: 18, color: tokens.claude, marginBottom: 4 }}>✦</div>
          <div style={{ fontFamily: tokens.sans, fontSize: 13, color: tokens.text, marginBottom: 2 }}>
            Tap to upload - or drag and drop
          </div>
          <div style={{
            fontFamily: tokens.mono, fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: tokens.textWhisper
          }}>
            Up to 20 · JPG · PNG
          </div>
        </label>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: '100%', background: tokens.ink3, overflow: 'hidden' }}>
              <img src={p.url} alt="" style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover'
              }} />
              {p.uploading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: '#00000099',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: tokens.textLoud
                }}>
                  Uploading...
                </div>
              )}
              <button
                onClick={() => removePhoto(i)}
                aria-label="Remove photo"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 20, height: 20,
                  background: '#000000CC', border: 'none',
                  color: tokens.textLoud, cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: tokens.serif, fontSize: 14, lineHeight: 1
                }}>
                ✕
              </button>
            </div>
          ))}
          {photos.length < 20 && (
            <label style={{
              position: 'relative', paddingBottom: '100%',
              border: `1px dashed ${tokens.line}`,
              cursor: 'pointer'
            }}>
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
              <span style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontFamily: tokens.serif, fontSize: 20, color: tokens.claude
              }}>+</span>
            </label>
          )}
        </div>
      )}
    </Field>
  );
}
