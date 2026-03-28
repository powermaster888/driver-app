import { apiRequest } from './client'

interface ItemQuantity {
  move_id: number
  delivered_qty: number
}

export async function submitPartialDelivery(jobId: number, body: {
  action_id: string
  items: ItemQuantity[]
  timestamp: string
}) {
  return apiRequest(`/jobs/${jobId}/partial-delivery`, { method: 'POST', body })
}
