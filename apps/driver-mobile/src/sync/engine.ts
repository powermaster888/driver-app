import NetInfo from '@react-native-community/netinfo'
import { useQueueStore } from '../store/queue'
import { syncBatch } from '../api/sync'

let syncInterval: ReturnType<typeof setInterval> | null = null
let consecutiveFailures = 0
const BASE_INTERVAL = 15_000 // 15s base
const MAX_INTERVAL = 5 * 60_000 // 5min max
const MAX_RETRIES = 10 // max retry count per action before requiring manual retry

function getBackoffInterval(): number {
  const interval = Math.min(BASE_INTERVAL * Math.pow(2, consecutiveFailures), MAX_INTERVAL)
  // Add jitter ±20%
  const jitter = interval * 0.2 * (Math.random() * 2 - 1)
  return Math.round(interval + jitter)
}

export function startSyncEngine() {
  // Process immediately on start (handles app restart with queued items)
  processQueue()

  // Listen for network changes
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      consecutiveFailures = 0
      processQueue()
    }
  })

  // Periodic retry with exponential backoff
  const scheduleNext = () => {
    const delay = getBackoffInterval()
    syncInterval = setTimeout(() => {
      const pending = useQueueStore.getState().getPending()
      if (pending.length > 0) {
        processQueue()
      } else {
        consecutiveFailures = 0
      }
      scheduleNext()
    }, delay) as unknown as ReturnType<typeof setInterval>
  }

  scheduleNext()
}

export function stopSyncEngine() {
  if (syncInterval) {
    clearTimeout(syncInterval as unknown as number)
    syncInterval = null
  }
}

export async function processQueue() {
  const { actions, updateAction, removeAction } = useQueueStore.getState()
  const pending = actions.filter(
    (a) => (a.status === 'queued' || a.status === 'failed') && (a.retryCount ?? 0) < MAX_RETRIES
  )
  if (pending.length === 0) return

  // Mark all as syncing
  pending.forEach((a) => updateAction(a.actionId, { status: 'syncing' }))

  try {
    const result = await syncBatch(pending)
    let allAccepted = true
    result.results.forEach((r) => {
      if (r.accepted) {
        removeAction(r.action_id)
      } else {
        allAccepted = false
        const existing = pending.find((a) => a.actionId === r.action_id)
        const retryCount = (existing?.retryCount ?? 0) + 1
        updateAction(r.action_id, {
          status: retryCount >= MAX_RETRIES ? 'failed' : 'queued',
          error: r.message || r.error || 'Unknown error',
          retryCount,
        })
      }
    })
    if (allAccepted) {
      consecutiveFailures = 0
    } else {
      consecutiveFailures++
    }
  } catch {
    // Network error — revert to queued, increment failures for backoff
    consecutiveFailures++
    pending.forEach((a) => {
      const retryCount = (a.retryCount ?? 0) + 1
      updateAction(a.actionId, {
        status: retryCount >= MAX_RETRIES ? 'failed' : 'queued',
        retryCount,
      })
    })
  }
}

/** Manual retry: reset retry count and re-queue a failed action */
export function retryAction(actionId: string) {
  const { updateAction } = useQueueStore.getState()
  updateAction(actionId, { status: 'queued', retryCount: 0, error: undefined })
  // Trigger immediate sync
  processQueue()
}

/** Retry all failed actions */
export function retryAllFailed() {
  const { actions, updateAction } = useQueueStore.getState()
  const failed = actions.filter((a) => a.status === 'failed')
  failed.forEach((a) => {
    updateAction(a.actionId, { status: 'queued', retryCount: 0, error: undefined })
  })
  if (failed.length > 0) processQueue()
}
