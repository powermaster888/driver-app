import { apiRequest } from './client'

interface LoginResponse {
  token: string
  driver: { id: number; name: string; phone: string }
}

export async function login(phone: string, pin: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { phone, pin },
  })
}
