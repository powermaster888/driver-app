import { Text, XStack } from 'tamagui'

export function OfflineBanner() {
  return (
    <XStack
      backgroundColor="#EF4444"
      paddingVertical={10}
      paddingHorizontal="$4"
      justifyContent="center"
    >
      <Text fontSize={12} fontWeight="600" color="white">
        離線中 — 操作將在連線後同步
      </Text>
    </XStack>
  )
}
