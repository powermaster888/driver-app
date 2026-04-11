import { apiRequest } from './client'

export async function updateStatus(jobId: number, body: {
  action_id: string
  status: string
  timestamp: string
  reason?: string
  note?: string
  completion_id?: string
}) {
  return apiRequest(`/jobs/${jobId}/status`, { method: 'POST', body })
}

export interface CompletionStatus {
  completion_id: string
  job_id: number
  has_pod: boolean
  has_cash: boolean
  has_status: boolean
  collection_required: boolean
  ready: boolean
}

export async function getCompletionStatus(jobId: number, completionId: string) {
  return apiRequest<CompletionStatus>(`/jobs/${jobId}/completion/${completionId}`)
}
