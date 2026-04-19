export function normalizeAttachments(att) {
  if (!att) return [];
  if (Array.isArray(att)) return att;
  if (typeof att === 'object') return [att];
  return [];
}

export function getTaskAttachments(att) {
  return normalizeAttachments(att).filter((a) => a && a.type === 'task');
}

export function getImageAttachments(att) {
  return normalizeAttachments(att).filter((a) => {
    if (!a) return false;
    if (a.type === 'images' && Array.isArray(a.urls) && a.urls.length > 0) return true;
    if (a.type === 'image' && a.url) return true;
    return false;
  }).map((a) => ({
    ...a,
    urls: a.urls || [a.url]
  }));
}
