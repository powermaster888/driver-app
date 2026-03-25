import { View } from 'tamagui'
import { useQueueStore } from '../store/queue'

export function SyncIndicator() {
  const actions = useQueueStore((s) => s.actions)
  const hasPending = actions.some((a) => a.status === 'queued' || a.status === 'syncing')
  const hasFailed = actions.some((a) => a.status === 'failed')

  const color = hasFailed ? '#dc2626' : hasPending ? '#f59e0b' : '#22c55e'

  return <View width={8} height={8} borderRadius={4} backgroundColor={color} />
}
