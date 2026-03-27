import { Text, XStack } from 'tamagui'
import { Banknote } from 'lucide-react-native'
import { useSettingsStore } from '../store/settings'

export function CashBadge({ method, amount }: { method: string; amount: number }) {
  const theme = useSettingsStore((s) => s.theme)
  const bg = theme === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2'

  return (
    <XStack backgroundColor={bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2" alignItems="center" gap={4} accessibilityLabel={`Cash collection required: ${method} ${amount} dollars`} accessibilityRole="text">
      <Banknote size={12} color="#dc2626" />
      <Text fontSize={11} fontWeight="600" color="#dc2626">
        {method === 'cheque' ? 'Cheque' : 'Cash'} ${amount.toLocaleString()}
      </Text>
    </XStack>
  )
}
