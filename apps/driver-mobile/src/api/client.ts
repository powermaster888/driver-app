import { useAuthStore } from '../store/auth'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface RequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401) {
    useAuthStore.getState().clearAuth()
    throw new Error('unauthorized')
  }

  const data = await response.json()

  if (!response.ok) {
    throw { status: response.status, ...data }
  }

  return data as T
}

export async function apiUpload(file: { uri: string; type: string; name: string }, fileType: 'photo' | 'signature') {
  const token = useAuthStore.getState().token
  const formData = new FormData()
  formData.append('file', file as any)
  formData.append('type', fileType)

  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) throw await response.json()
  return response.json()
}
