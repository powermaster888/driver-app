import { View, XStack, Text } from 'tamagui'
import { useQueueStore } from '../store/queue'

export function SyncIndicator() {
  const actions = useQueueStore((s) => s.actions)
  const hasPending = actions.some((a) => a.status === 'queued' || a.status === 'syncing')
  const hasFailed = actions.some((a) => a.status === 'failed')
  const color = hasFailed ? '#dc2626' : hasPending ? '#f59e0b' : '#22c55e'
  const label = hasFailed ? 'Failed' : hasPending ? 'Syncing' : ''

  return (
    <XStack alignItems="center" gap="$1" accessibilityLabel={hasFailed ? 'Sync failed' : hasPending ? 'Sync pending' : 'Synced'} accessibilityRole="text">
      <View width={8} height={8} borderRadius={4} backgroundColor={color} />
      {label ? <Text fontSize={10} color={color} fontWeight="600">{label}</Text> : null}
    </XStack>
  )
}
