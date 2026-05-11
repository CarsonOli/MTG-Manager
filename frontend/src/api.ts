const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5131'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Request failed.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function apiRequest<T>(path: string, token: string | null, options: RequestInit = {}) {
  return request<T>(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
