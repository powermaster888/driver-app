import { Text, XStack } from 'tamagui'

export function CashBadge({ method, amount }: { method: string; amount: number }) {
  return (
    <XStack backgroundColor="#fef2f2" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize={11} fontWeight="600" color="#dc2626">
        {method === 'cheque' ? 'Cheque' : 'Cash'} ${amount.toLocaleString()}
      </Text>
    </XStack>
  )
}
