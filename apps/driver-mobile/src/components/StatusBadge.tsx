import { Text, XStack } from 'tamagui'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'

const LABELS: Record<DeliveryStatus, string> = {
  assigned: '待分配',
  accepted: '已接單',
  on_the_way: '前往中',
  arrived: '已到達',
  delivered: '已送達',
  failed: '失敗',
  returned: '已退回',
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const colors = STATUS_COLORS[status]

  return (
    <XStack backgroundColor={colors.filled} paddingHorizontal={10} paddingVertical={4} borderRadius={9999} accessibilityLabel={`狀態: ${LABELS[status]}`} accessibilityRole="text">
      <Text fontSize={10} fontWeight="800" color="white" letterSpacing={0.5} textTransform="uppercase">
        {LABELS[status]}
      </Text>
    </XStack>
  )
}
