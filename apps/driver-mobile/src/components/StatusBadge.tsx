import { Text, XStack } from 'tamagui'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'

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
  const colors = STATUS_COLORS[status]

  return (
    <XStack backgroundColor={colors.filled} paddingHorizontal={10} paddingVertical={4} borderRadius={6} accessibilityLabel={`Status: ${LABELS[status]}`} accessibilityRole="text">
      <Text fontSize={10} fontWeight="800" color={colors.filledText} letterSpacing={1} textTransform="uppercase">
        {LABELS[status]}
      </Text>
    </XStack>
  )
}
