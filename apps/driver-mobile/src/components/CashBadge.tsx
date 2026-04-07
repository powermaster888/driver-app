import { Text, XStack, useTheme } from 'tamagui'
import { Banknote } from 'lucide-react-native'

export function CashBadge({ method, amount }: { method: string; amount: number }) {
  const theme = useTheme()
  const dangerColor = theme.danger?.val || '#dc2626'

  return (
    <XStack backgroundColor="$backgroundStrong" paddingHorizontal={8} paddingVertical={4} borderRadius={9999} alignItems="center" gap={4} accessibilityLabel={`Cash collection required: ${method} ${amount} dollars`} accessibilityRole="text">
      <Banknote size={12} color={dangerColor} />
      <Text fontSize={11} fontWeight="700" color="$danger">
        {method === 'cheque' ? 'Cheque' : 'Cash'} ${amount.toLocaleString()}
      </Text>
    </XStack>
  )
}
