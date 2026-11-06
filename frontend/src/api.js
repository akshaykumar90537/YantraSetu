export function canRent(user) {
  return Boolean(user?.roles?.includes('farmer') && !user.roles.includes('owner'));
}

export async function api(path, data, customMethod) {
  const method = customMethod || (data ? 'POST' : 'GET');
  const apiBase =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
      : '';
  let response;
  try {
    response = await fetch(apiBase + '/api' + path, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'YantraSetu' },
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error('Cannot reach YantraSetu. Check your connection and retry.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    if (response.status === 401 && path !== '/me' && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('ys:unauthorized'));
    const error = new Error(typeof body?.detail === 'string' ? body.detail : 'YantraSetu could not confirm this request. Please retry.');
    error.status = response.status;
    throw error;
  }
  return body;
}
