import { Text, XStack } from 'tamagui'

export function OfflineBanner() {
  return (
    <XStack backgroundColor="#fef3c7" padding="$2" justifyContent="center">
      <Text fontSize={12} fontWeight="600" color="#92400e">
        Offline — actions will sync when connected
      </Text>
    </XStack>
  )
}
