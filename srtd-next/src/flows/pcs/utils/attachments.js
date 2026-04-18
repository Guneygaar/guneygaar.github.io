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
  return normalizeAttachments(att).filter(a => a && a.type === 'images' && Array.isArray(a.urls));
}
