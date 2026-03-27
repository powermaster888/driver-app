import { Text, XStack } from 'tamagui'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'
import { useSettingsStore } from '../store/settings'

const LABELS: Record<DeliveryStatus, string> = {
  assigned: 'ASSIGNED',
  accepted: 'ACCEPTED',
  on_the_way: 'ON THE WAY',
  arrived: 'ARRIVED',
  delivered: 'DELIVERED',
  failed: 'FAILED',
  returned: 'RETURNED',
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const theme = useSettingsStore((s) => s.theme)
  const colors = STATUS_COLORS[status]
  const bg = theme === 'dark' ? colors.darkBg : colors.bg
  const color = theme === 'dark' ? colors.darkText : colors.text

  return (
    <XStack backgroundColor={bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2" accessibilityLabel={`Status: ${LABELS[status]}`} accessibilityRole="text">
      <Text fontSize={10} fontWeight="700" color={color} letterSpacing={0.5}>
        {LABELS[status]}
      </Text>
    </XStack>
  )
}
