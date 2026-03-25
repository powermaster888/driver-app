import { apiRequest } from './client'

export async function updateStatus(jobId: number, body: {
  action_id: string
  status: string
  timestamp: string
  reason?: string
  note?: string
}) {
  return apiRequest(`/jobs/${jobId}/status`, { method: 'POST', body })
}
