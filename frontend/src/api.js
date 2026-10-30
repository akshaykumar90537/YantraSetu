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
    throw new Error('The API is unavailable. Start PostgreSQL and the backend using the README.');
  }

  if (!response.ok) {
    const errorMsg = typeof body.detail === 'string' 
      ? body.detail 
      : (body.detail ? JSON.stringify(body.detail) : JSON.stringify(body));
    throw new Error(errorMsg);
  }

  return body;
}

