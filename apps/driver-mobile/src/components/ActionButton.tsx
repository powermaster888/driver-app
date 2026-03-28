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

  const bg = color || (variant === 'primary' ? '#2563eb' : variant === 'danger' ? '#dc2626' : 'transparent')
  const textColor = variant === 'outline' ? '#dc2626' : 'white'
  const borderColor = variant === 'outline' ? '#dc2626' : 'transparent'

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()
  }
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start()
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
          { backgroundColor: bg, borderColor, borderWidth: variant === 'outline' ? 2 : 0, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Text fontSize={15} fontWeight="700" color={textColor}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
})
