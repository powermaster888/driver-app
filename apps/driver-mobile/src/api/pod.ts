import { apiRequest } from './client'

export async function submitPod(jobId: number, body: {
  action_id: string
  photo_upload_ids: string[]
  signature_upload_id?: string
  note?: string
  timestamp: string
  completion_id?: string
}) {
  return apiRequest(`/jobs/${jobId}/proof-of-delivery`, { method: 'POST', body })
}
