import React, { useRef } from 'react'
import { Animated, Pressable, StyleSheet } from 'react-native'
import { Text } from 'tamagui'

interface Props {
  label: string
  onPress: () => void
  variant?: 'primary' | 'danger' | 'outline'
  color?: string
  disabled?: boolean
}

export function ActionButton({ label, onPress, variant = 'primary', color, disabled }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  const bg = color || (variant === 'primary' ? '#2563EB' : variant === 'danger' ? '#EF4444' : 'transparent')
  const textColor = variant === 'outline' ? '#EF4444' : 'white'
  const borderCol = variant === 'outline' ? '#EF4444' : 'transparent'

  const onPressIn = () => {
    Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }).start()
  }
  const onPressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start()
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityRole="button"
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderColor: borderCol,
            borderWidth: variant === 'outline' ? 2 : 0,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text fontSize={16} fontWeight="700" color={textColor}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
})
