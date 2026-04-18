import { ownerToRole } from './stage.js';

export function findUserRole(email, userRoles) {
  if (!email || !Array.isArray(userRoles)) return null;
  return userRoles.find(u => u.email === email) || null;
}

export function displayNameFromEmail(email, userRoles) {
  if (!email) return 'Unknown';
  const found = findUserRole(email, userRoles);
  if (!found) return null;
  return found.name || email.split('@')[0];
}

export function roleFromEmail(email, userRoles, fallback = 'creative') {
  if (!email) return 'unknown';
  const found = findUserRole(email, userRoles);
  if (!found) return fallback;
  return ownerToRole(found.role);
}
