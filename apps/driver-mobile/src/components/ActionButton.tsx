import { Button } from 'tamagui'

interface Props {
  label: string
  onPress: () => void
  variant?: 'primary' | 'danger' | 'outline'
}

export function ActionButton({ label, onPress, variant = 'primary' }: Props) {
  const bg = variant === 'primary' ? '$primary' : variant === 'danger' ? '$danger' : 'transparent'
  const color = variant === 'outline' ? '$danger' : 'white'
  const borderColor = variant === 'outline' ? '$danger' : undefined

  return (
    <Button
      size="$5"
      backgroundColor={bg}
      color={color}
      borderColor={borderColor}
      borderWidth={variant === 'outline' ? 2 : 0}
      fontWeight="700"
      borderRadius={14}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      minHeight={56}
    >
      {label}
    </Button>
  )
}
