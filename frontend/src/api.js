export async function api(path, data, customMethod) {
  const method = customMethod || (data ? 'POST' : 'GET');
  const response = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'YantraSetu',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`Server error (${response.status}): ${text.slice(0, 100) || response.statusText}`);
    }
    throw new Error('The API is unavailable. Start PostgreSQL and the backend using the README.');
  }

  if (!response.ok) {
    const errorMsg = typeof body.detail === 'string' 
      ? body.detail 
      : (body.detail ? JSON.stringify(body.detail) : JSON.stringify(body));
    const error = new Error(errorMsg);
    error.status = response.status;
    if (response.status === 401 && path !== '/me' && !path.startsWith('/auth/')) window.dispatchEvent(new Event('ys:unauthorized'));
    throw error;
  }

  return body;
}
