let __token = null;
export function setToken(t) { __token = t; }

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (__token) headers['Authorization'] = `Bearer ${__token}`;
  const res = await fetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  stats: () => req('GET', '/api/stats'),
  churches: {
    list: (search) =>
      req('GET', search ? `/api/churches?search=${encodeURIComponent(search)}` : '/api/churches'),
    update: (id, data) => req('PATCH', `/api/churches?id=${encodeURIComponent(id)}`, data),
    detail: (id) => req('GET', `/api/church-detail?id=${encodeURIComponent(id)}`),
  },
};
