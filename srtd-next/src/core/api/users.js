import { apiFetch } from './client.js';

export async function listUserRoles() {
  const profiles = await apiFetch(
    '/profiles?select=id,email,display_name,role,avatar_url',
    { method: 'GET', headers: { 'Accept': 'application/json' } }
  );
  if (!Array.isArray(profiles)) return [];
  return profiles.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.display_name,
    display_name: p.display_name,
    role: p.role || 'client',
    avatar_url: p.avatar_url || null
  }));
}
