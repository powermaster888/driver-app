import React from 'react'
import { Card, YStack, XStack } from 'tamagui'

export function JobCardSkeleton() {
  return (
    <Card borderWidth={1} borderColor="$borderColor" padding="$4" marginBottom="$2" borderRadius={14} opacity={0.6}>
      <XStack justifyContent="space-between">
        <YStack gap="$1" flex={1}>
          <YStack width="60%" height={16} backgroundColor="$colorSubtle" borderRadius={4} opacity={0.3} />
          <YStack width="40%" height={12} backgroundColor="$colorSubtle" borderRadius={4} opacity={0.2} />
        </YStack>
        <YStack width={70} height={20} backgroundColor="$colorSubtle" borderRadius={10} opacity={0.2} />
      </XStack>
      <XStack gap="$2" marginTop="$2">
        <YStack width={80} height={16} backgroundColor="$colorSubtle" borderRadius={4} opacity={0.2} />
      </XStack>
    </Card>
  )
}
