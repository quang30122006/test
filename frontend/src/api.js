const API_BASE = '';

export function getToken() {
  return localStorage.getItem('agribank_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('agribank_token', token);
  else localStorage.removeItem('agribank_token');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken('');
    window.dispatchEvent(new CustomEvent('agribank:unauthorized'));
  }
  if (!res.ok) {
    let msg = `Lỗi HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return res;
}

export async function apiDownload(path, filename) {
  const res = await apiFetch(path, { method: 'GET' });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

