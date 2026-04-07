import { Pressable, Alert } from 'react-native'
import { Image, XStack, YStack } from 'tamagui'
import { X } from 'lucide-react-native'

interface Props {
  uri: string
  onDelete?: () => void
  size?: number
}

export function PhotoThumbnail({ uri, onDelete, size = 72 }: Props) {
  return (
    <YStack position="relative">
      <Image
        source={{ uri }}
        width={size}
        height={size}
        borderRadius={10}
      />
      {onDelete && (
        <Pressable
          onPress={() => {
            Alert.alert('Delete Photo', 'Remove this photo?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
            ])
          }}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#dc2626',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 1,
            elevation: 2,
          }}
          accessibilityLabel="Delete photo"
          accessibilityRole="button"
        >
          <X size={14} color="white" />
        </Pressable>
      )}
    </YStack>
  )
}
