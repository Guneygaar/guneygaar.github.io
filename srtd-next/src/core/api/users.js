import { apiFetch } from './client.js';

export async function listUserRoles() {
  const rows = await apiFetch('/user_roles?select=id,email,name,role', {
    method: 'GET', headers: { 'Accept': 'application/json' }
  });
  return Array.isArray(rows) ? rows : [];
}
