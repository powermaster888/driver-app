import { Text, XStack } from 'tamagui'
import { Banknote } from 'lucide-react-native'

export function CashBadge({ method, amount }: { method: string; amount: number }) {
  return (
    <XStack backgroundColor="rgba(239,68,68,0.1)" paddingHorizontal={8} paddingVertical={3} borderRadius={9999} alignItems="center" gap={4} accessibilityLabel={`代收: ${method} $${amount}`} accessibilityRole="text">
      <Banknote size={12} color="#EF4444" />
      <Text fontSize={11} fontWeight="700" color="#EF4444">
        {method === 'cheque' ? '支票' : '現金'} ${amount.toLocaleString()}
      </Text>
    </XStack>
  )
}
