export function normalizeAttachments(att) {
  if (!att) return [];
  if (typeof att === 'string') {
    try { att = JSON.parse(att); } catch (err) { return []; }
    if (!att) return [];
  }
  if (typeof att === 'string') {
    try { att = JSON.parse(att); } catch (err) { return []; }
    if (!att) return [];
  }
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
    if (a.type !== 'image' && a.type !== 'images') return false;
    if (Array.isArray(a.urls) && a.urls.length > 0) return true;
    if (a.url) return true;
    return false;
  }).map((a) => ({
    ...a,
    urls: a.urls || [a.url]
  }));
}
