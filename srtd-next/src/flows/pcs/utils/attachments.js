export function normalizeAttachments(att) {
  if (!att) return [];
  if (Array.isArray(att)) return att;
  if (typeof att === 'object') return [att];
  return [];
}

export function getTaskAttachments(att) {
  return normalizeAttachments(att).filter(a => a && a.type === 'task');
}

export function getImageAttachments(att) {
  return normalizeAttachments(att).map(a => {
    if (!a) return null;
    if (a.type === 'images' && Array.isArray(a.urls) && a.urls.length > 0) return a;
    if (a.type === 'image' && a.url) return { ...a, urls: [a.url] };
    if (Array.isArray(a.urls) && a.urls.length > 0) return a;
    if (typeof a === 'string') return { type: 'image', urls: [a] };
    if (a.url && !a.urls) return { ...a, urls: [a.url] };
    return null;
  }).filter(Boolean);
}
