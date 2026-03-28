import { Alert, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { YStack, XStack, Text, Card, Switch } from 'tamagui'
import { Moon, RefreshCw, LogOut } from 'lucide-react-native'
import { useAuthStore } from '../../../src/store/auth'
import { useSettingsStore } from '../../../src/store/settings'
import { useQueueStore } from '../../../src/store/queue'
import { showToast, triggerHaptic } from '../../../src/utils/feedback'

export default function SettingsTab() {
  const router = useRouter()
  const { driver, clearAuth } = useAuthStore()
  const { theme, setTheme } = useSettingsStore()
  const actions = useQueueStore((s) => s.actions)
  const pending = actions.filter((a) => a.status === 'queued' || a.status === 'syncing')
  const failed = actions.filter((a) => a.status === 'failed')
  const iconColor = theme === 'dark' ? '#F1F5F9' : '#1E293B'

  const handleLogout = async () => {
    if (pending.length > 0 || failed.length > 0) {
      Alert.alert(
        'Unsynced Actions',
        `You have ${pending.length + failed.length} unsynced actions. Sync first or force logout.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Force Logout',
            style: 'destructive',
            onPress: async () => {
              await triggerHaptic('warning')
              clearAuth()
              router.replace('/login')
            },
          },
        ]
      )
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            await triggerHaptic('light')
            clearAuth()
            router.replace('/login')
          },
        },
      ])
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <YStack flex={1} backgroundColor="$background">
        <YStack paddingHorizontal={16} paddingTop={48} gap={12}>
          <Text fontSize={20} fontWeight="800">Settings</Text>
          {/* Profile card */}
          <Card padding="$5" borderWidth={1} borderColor="$borderColor" borderRadius={20} alignItems="center">
            <YStack width={64} height={64} borderRadius={20} backgroundColor="#2563eb" alignItems="center" justifyContent="center">
              <Text fontSize={28} fontWeight="800" color="white">{driver?.name?.charAt(0)}</Text>
            </YStack>
            <Text fontSize={22} fontWeight="800" marginTop="$3">{driver?.name}</Text>
            <Text fontSize={13} color="$colorSubtle">{driver?.phone}</Text>

            {/* Stats row */}
            <XStack justifyContent="space-around" width="100%" marginTop="$4" paddingTop="$3" borderTopWidth={1} borderTopColor="$borderColor">
              <YStack alignItems="center">
                <Text fontSize={20} fontWeight="800">--</Text>
                <Text fontSize={11} color="$colorSubtle">Deliveries</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontSize={20} fontWeight="800" color="#22c55e">--</Text>
                <Text fontSize={11} color="$colorSubtle">On Time</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontSize={20} fontWeight="800">--</Text>
                <Text fontSize={11} color="$colorSubtle">Rating</Text>
              </YStack>
            </XStack>
          </Card>

          {/* Grouped settings card */}
          <Card borderWidth={1} borderColor="$borderColor" borderRadius={16} overflow="hidden">
            {/* Dark Mode row */}
            <XStack padding="$4" justifyContent="space-between" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack alignItems="center" gap={12}>
                <YStack width={32} height={32} borderRadius={8} backgroundColor="#f1f5f9" alignItems="center" justifyContent="center">
                  <Moon size={16} color={iconColor} />
                </YStack>
                <Text fontSize={14} fontWeight="500">Dark Mode</Text>
              </XStack>
              <Switch checked={theme === 'dark'} onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}>
                <Switch.Thumb />
              </Switch>
            </XStack>

            {/* Sync Status row */}
            <XStack padding="$4" justifyContent="space-between" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack alignItems="center" gap={12}>
                <YStack width={32} height={32} borderRadius={8} backgroundColor="#f0fdf4" alignItems="center" justifyContent="center">
                  <RefreshCw size={16} color="#22c55e" />
                </YStack>
                <YStack>
                  <Text fontSize={14} fontWeight="500">Sync Status</Text>
                  <Text fontSize={11} color={failed.length > 0 ? '#dc2626' : '#22c55e'}>{failed.length > 0 ? `${failed.length} failed` : 'All synced'}</Text>
                </YStack>
              </XStack>
            </XStack>

            {/* Sign Out row */}
            <Pressable onPress={handleLogout}>
              <XStack padding="$4" alignItems="center" gap={12}>
                <YStack width={32} height={32} borderRadius={8} backgroundColor="#fef2f2" alignItems="center" justifyContent="center">
                  <LogOut size={16} color="#dc2626" />
                </YStack>
                <Text fontSize={14} fontWeight="500" color="#dc2626">Sign Out</Text>
              </XStack>
            </Pressable>
          </Card>

          <Text fontSize={11} color="$colorSubtle" textAlign="center" marginTop="$4" paddingBottom={24} opacity={0.5}>
            Driver App v2.0.0 · Healthy Living Medical Supplies
          </Text>
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
