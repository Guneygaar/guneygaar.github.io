import { apiFetch } from './client.js';

export async function listUserRoles() {
  const [roles, profiles] = await Promise.all([
    apiFetch('/user_roles?select=id,email,name,role', { method: 'GET', headers: { 'Accept': 'application/json' } }),
    apiFetch('/profiles?select=email,display_name,avatar_url', { method: 'GET', headers: { 'Accept': 'application/json' } })
  ]);
  if (!Array.isArray(roles)) return [];
  const profileMap = new Map();
  if (Array.isArray(profiles)) {
    for (const p of profiles) profileMap.set(p.email, p);
  }
  return roles.map((r) => {
    const p = profileMap.get(r.email);
    return {
      ...r,
      display_name: (p && p.display_name) || r.name,
      avatar_url: (p && p.avatar_url) || null
    };
  });
}
