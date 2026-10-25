const metaEnv = (import.meta as any).env || {};
const API_BASE_URL = (metaEnv.VITE_API_URL || metaEnv.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export function getAuthToken(): string | null {
  return localStorage.getItem('smvitm_auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('smvitm_auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('smvitm_auth_token');
  localStorage.removeItem('smvitm_auth_user');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP error ${response.status}`;
    try {
      // Read the body as text FIRST so the stream is consumed safely without crashing
      const rawText = await response.text();
      if (rawText) {
        try {
          const errJson = JSON.parse(rawText);
          errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch {
          // If backend returned HTML (e.g. Vite proxy ECONNREFUSED or 502/504 gateway error)
          if (rawText.includes('ECONNREFUSED') || rawText.includes('504 Gateway') || rawText.includes('502 Bad Gateway')) {
            errorDetail = 'Backend server is not running or unreachable. Please start the backend server (uvicorn app.main:app --reload) on port 8000.';
          } else if (rawText.length > 250) {
            errorDetail = `Server returned status ${response.status} (${response.statusText || 'Error'}). Please check backend connection.`;
          } else {
            errorDetail = rawText;
          }
        }
      } else {
        errorDetail = response.statusText || `HTTP error ${response.status}`;
      }
    } catch {
      errorDetail = response.statusText || `HTTP error ${response.status}`;
    }

    // Friendly institutional explanation for common login credential mismatches
    if (response.status === 401 && typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('incorrect email')) {
      errorDetail = 'Incorrect email or password. If you are a new user, please click the "Register" tab above to create your profile first.';
    }

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      errorDetail = 'Backend server is unreachable. Please verify that the Python backend (uvicorn app.main:app) is running on port 8000.';
    }

    throw new Error(errorDetail || `HTTP error ${response.status}`);
  }

  // Handle blob or text if content-type indicates CSV
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    const blob = await response.blob();
    return blob as unknown as T;
  }

  return response.json();
}
