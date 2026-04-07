import { Text, XStack } from 'tamagui'
import { useSettingsStore } from '../store/settings'

export function OfflineBanner() {
  const themeMode = useSettingsStore((s) => s.theme)
  const isDark = themeMode === 'dark'

  return (
    <XStack
      backgroundColor={isDark ? 'rgba(245,158,11,0.12)' : '#fef3c7'}
      paddingVertical={10}
      paddingHorizontal="$4"
      justifyContent="center"
    >
      <Text fontSize={12} fontWeight="600" color={isDark ? '#FBBF24' : '#92400e'}>
        Offline — actions will sync when connected
      </Text>
    </XStack>
  )
}
