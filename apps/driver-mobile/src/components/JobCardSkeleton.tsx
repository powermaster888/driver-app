import React, { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { Card, YStack, XStack } from 'tamagui'

export function JobCardSkeleton() {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [shimmerAnim])

  return (
    <Card
      backgroundColor="$backgroundStrong"
      borderWidth={0}
      borderLeftWidth={3}
      borderLeftColor="$borderColor"
      padding="$4"
      marginBottom="$2"
      borderRadius={12}
    >
      <Animated.View style={{ opacity: shimmerAnim }}>
        <XStack justifyContent="space-between">
          <YStack gap="$1" flex={1}>
            <YStack width="60%" height={16} backgroundColor="$surfaceHover" borderRadius={4} />
            <YStack width="40%" height={12} backgroundColor="$surfaceHover" borderRadius={4} />
          </YStack>
          <YStack width={70} height={20} backgroundColor="$surfaceHover" borderRadius={9999} />
        </XStack>
        <XStack gap="$2" marginTop="$2">
          <YStack width={80} height={14} backgroundColor="$surfaceHover" borderRadius={4} />
        </XStack>
      </Animated.View>
    </Card>
  )
}
