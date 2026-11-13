const rawApiUrl = import.meta.env.VITE_API_URL || '/api';

export const webEnv = (() => {
  try {
    return { apiUrl: new URL(rawApiUrl, window.location.origin).toString().replace(/\/$/, '') };
  } catch {
    throw new Error('VITE_API_URL must be an HTTP(S) URL or a same-origin path');
  }
})();
