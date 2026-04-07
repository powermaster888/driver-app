import { View, XStack, Text, useTheme } from 'tamagui'
import { useQueueStore } from '../store/queue'

export function SyncIndicator() {
  const theme = useTheme()
  const actions = useQueueStore((s) => s.actions)
  const pendingCount = actions.filter((a) => a.status === 'queued' || a.status === 'syncing').length
  const failedCount = actions.filter((a) => a.status === 'failed').length
  const hasPending = pendingCount > 0
  const hasFailed = failedCount > 0

  const dangerColor = theme.danger?.val || '#dc2626'
  const warningColor = theme.warning?.val || '#f59e0b'
  const successColor = theme.success?.val || '#22c55e'

  const color = hasFailed ? dangerColor : hasPending ? warningColor : successColor
  const count = hasFailed ? failedCount : pendingCount
  const label = hasFailed ? `${count} failed` : hasPending ? `${count} pending` : ''

  return (
    <XStack alignItems="center" gap="$1" accessibilityLabel={hasFailed ? `${failedCount} sync failed` : hasPending ? `${pendingCount} sync pending` : 'Synced'} accessibilityRole="text">
      <View width={8} height={8} borderRadius={4} backgroundColor={color} />
      {label ? <Text fontSize={10} color={color} fontWeight="600">{label}</Text> : null}
    </XStack>
  )
}
