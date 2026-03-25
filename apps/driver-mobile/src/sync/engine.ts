import NetInfo from '@react-native-community/netinfo'
import { useQueueStore } from '../store/queue'
import { syncBatch } from '../api/sync'

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startSyncEngine() {
  // Listen for network changes
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      processQueue()
    }
  })

  // Periodic retry every 30 seconds
  syncInterval = setInterval(() => {
    const pending = useQueueStore.getState().getPending()
    if (pending.length > 0) processQueue()
  }, 30_000)
}

export function stopSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

async function processQueue() {
  const { actions, updateAction, removeAction } = useQueueStore.getState()
  const pending = actions.filter((a) => a.status === 'queued' || a.status === 'failed')
  if (pending.length === 0) return

  // Mark all as syncing
  pending.forEach((a) => updateAction(a.actionId, { status: 'syncing' }))

  try {
    const result = await syncBatch(pending)
    result.results.forEach((r) => {
      if (r.accepted) {
        removeAction(r.action_id)
      } else {
        updateAction(r.action_id, {
          status: 'failed',
          error: r.message || r.error || 'Unknown error',
        })
      }
    })
  } catch {
    // Network error — revert to queued
    pending.forEach((a) => updateAction(a.actionId, { status: 'queued' }))
  }
}
