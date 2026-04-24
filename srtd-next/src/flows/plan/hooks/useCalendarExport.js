// Calendar PNG export. Mounts an off-screen CalendarExport tree,
// waits for fonts and images, rasterises with html-to-image, then
// triggers either the iOS share sheet (if Web Share Level 2 with
// files is available) or a normal anchor download. Caps total
// pre-capture wait near 3 seconds so a single unreachable R2 asset
// cannot stall the export forever.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { CalendarExport } from '../export/CalendarExport.jsx';
import { usePlanStore } from '../store/planStore.js';

function showToast(msg) {
  try {
    const state = usePlanStore.getState && usePlanStore.getState();
    if (state && typeof state.showToast === 'function') {
      state.showToast({ msg, duration: 3000 });
      return;
    }
  } catch (e) { /* fall through */ }
  try {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg, 'error');
    }
  } catch (e) { /* noop */ }
}

function waitFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 16);
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}

function waitForImages(root, maxMs) {
  if (!root) return Promise.resolve();
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  const promises = imgs.map((img) => new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) { resolve(); return; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      resolve();
    };
    img.addEventListener('load', finish);
    img.addEventListener('error', finish);
  }));
  const timeout = new Promise((resolve) => setTimeout(resolve, maxMs));
  return Promise.race([Promise.all(promises), timeout]);
}

function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) throw new Error('Invalid data URL');
  const meta = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const isBase64 = meta.indexOf(';base64') !== -1;
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  if (!isBase64) {
    return new Blob([decodeURIComponent(body)], { type: mime });
  }
  const binary = atob(body);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function mountAndCapture(monthPosts, monthDate) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const container = document.createElement('div');
  container.setAttribute('data-calendar-export-host', '');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  let root = null;
  try {
    root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(CalendarExport, {
        monthPosts: monthPosts,
        monthDate: monthDate
      })
    );

    // Let React commit, then allow fonts + images to settle.
    await waitFrame();
    await waitFrame();
    try {
      if (document && document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    } catch (e) { /* ignore font failures */ }
    await waitFrame();

    // Cap image wait at ~2.5 s so total pre-capture wait stays <= 3 s.
    await waitForImages(container, 2500);

    const exportRoot = container.firstChild;
    if (!exportRoot) throw new Error('Export root missing');

    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(exportRoot, {
      pixelRatio: isIOS ? 1 : 2,
      cacheBust: true,
      backgroundColor: getComputedStyle(exportRoot).backgroundColor || '#FAF7F0'
    });

    const blob = dataUrlToBlob(dataUrl);
    const fileName = 'sorted-calendar.png';

    let shared = false;
    if (isIOS && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Sorted Calendar' });
          shared = true;
        }
      } catch (e) {
        // User cancel or share failure falls through to anchor download.
        shared = false;
      }
    }

    if (!shared) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (e) { /* noop */ }
      }, 1000);
    }
  } finally {
    try { if (root) root.unmount(); } catch (e) { /* noop */ }
    try {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    } catch (e) { /* noop */ }
  }
}

export async function exportCalendarAsPng(monthPosts, monthDate) {
  try {
    if (!monthDate) throw new Error('monthDate required');
    await mountAndCapture(monthPosts || [], monthDate);
  } catch (err) {
    try {
      if (typeof window !== 'undefined' && typeof window.logError === 'function') {
        window.logError(err, { context: 'plan_calendar_export' });
      }
    } catch (e) { /* noop */ }
    showToast('Export failed. Try again.');
  }
}
