import { apiRequest } from './client'

export async function submitCash(jobId: number, body: {
  action_id: string
  amount: number
  method: string
  reference: string
  photo_upload_id?: string
  timestamp: string
  completion_id?: string
}) {
  return apiRequest(`/jobs/${jobId}/cash-collection`, { method: 'POST', body })
}
