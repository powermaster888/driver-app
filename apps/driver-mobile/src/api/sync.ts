import { apiRequest } from './client'
import type { QueuedAction } from '../store/queue'

interface BatchResult {
  action_id: string
  accepted: boolean
  replayed?: boolean
  upload_id?: string
  error?: string
  message?: string
}

interface BatchResponse {
  results: BatchResult[]
  synced: number
  failed: number
}

export async function syncBatch(actions: QueuedAction[]): Promise<BatchResponse> {
  return apiRequest<BatchResponse>('/sync/batch', {
    method: 'POST',
    body: {
      actions: actions.map((a) => ({
        action_id: a.actionId,
        endpoint: a.endpoint,
        method: a.method,
        body: a.body,
        file: a.file,
      })),
    },
  })
}
