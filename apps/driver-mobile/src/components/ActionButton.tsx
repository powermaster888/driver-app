import { Button, Text } from 'tamagui'

interface Props {
  label: string
  onPress: () => void
  variant?: 'primary' | 'danger' | 'outline'
  color?: string
}

export function ActionButton({ label, onPress, variant = 'primary', color: customColor }: Props) {
  const bg = variant === 'outline' ? 'transparent' : customColor ? customColor : variant === 'danger' ? '$danger' : '$primary'
  const textColor = variant === 'outline' ? '$danger' : 'white'
  const borderColor = variant === 'outline' ? '$danger' : undefined

  return (
    <Button
      size="$5"
      backgroundColor={bg}
      borderColor={borderColor}
      borderWidth={variant === 'outline' ? 2 : 0}
      borderRadius={14}
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
      minHeight={56}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text color={textColor} fontWeight="700" fontSize={16}>{label}</Text>
    </Button>
  )
}
