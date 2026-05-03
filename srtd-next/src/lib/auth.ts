export const isAuthed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return !!(localStorage.getItem('sb_access_token') ||
              localStorage.getItem('sb_refresh_token'));
  } catch {
    return false;
  }
};
