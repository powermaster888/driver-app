import { Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { YStack, XStack, Text, Card, Switch, Button, Separator } from 'tamagui'
import { User, Moon, RefreshCw, LogOut } from 'lucide-react-native'
import { useAuthStore } from '../src/store/auth'
import { useSettingsStore } from '../src/store/settings'
import { useQueueStore } from '../src/store/queue'

export default function Settings() {
  const router = useRouter()
  const { driver, clearAuth } = useAuthStore()
  const { theme, setTheme } = useSettingsStore()
  const actions = useQueueStore((s) => s.actions)
  const pending = actions.filter((a) => a.status === 'queued' || a.status === 'syncing')
  const failed = actions.filter((a) => a.status === 'failed')
  const iconColor = theme === 'dark' ? '#F1F5F9' : '#1E293B'

  const handleLogout = () => {
    if (pending.length > 0 || failed.length > 0) {
      Alert.alert(
        'Unsynced Actions',
        `You have ${pending.length + failed.length} unsynced actions. Sync first or force logout.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Force Logout', style: 'destructive', onPress: () => { clearAuth(); router.replace('/login') } },
        ]
      )
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => { clearAuth(); router.replace('/login') } },
      ])
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: 'Settings' }} />
      <YStack padding="$4" gap="$4">
        {/* Driver info */}
        <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={14}>
          <XStack alignItems="center" gap={8} marginBottom="$2">
            <User size={20} color={iconColor} />
            <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Driver</Text>
          </XStack>
          <Text fontSize={18} fontWeight="700">{driver?.name}</Text>
          <Text fontSize={13} color="$colorSubtle">{driver?.phone}</Text>
        </Card>

        {/* Theme */}
        <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={14}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap={10}>
              <Moon size={20} color={iconColor} />
              <YStack>
                <Text fontSize={14} fontWeight="600">Dark Mode</Text>
                <Text fontSize={12} color="$colorSubtle">Switch to dark theme</Text>
              </YStack>
            </XStack>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            >
              <Switch.Thumb />
            </Switch>
          </XStack>
        </Card>

        {/* Sync status */}
        <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={14}>
          <XStack alignItems="center" gap={8} marginBottom="$2">
            <RefreshCw size={20} color={iconColor} />
            <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Sync Status</Text>
          </XStack>
          <YStack marginTop="$2" gap="$2">
            <XStack justifyContent="space-between">
              <Text fontSize={14}>Pending</Text>
              <Text fontSize={14} fontWeight="700" color={pending.length > 0 ? '#f59e0b' : '$color'}>
                {pending.length}
              </Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text fontSize={14}>Failed</Text>
              <Text fontSize={14} fontWeight="700" color={failed.length > 0 ? '$danger' : '$color'}>
                {failed.length}
              </Text>
            </XStack>
          </YStack>
          {failed.length > 0 && (
            <YStack marginTop="$3" gap="$1">
              <Separator />
              {failed.map((a) => (
                <Text key={a.actionId} fontSize={11} color="$danger" marginTop="$1">
                  {a.endpoint}: {a.error}
                </Text>
              ))}
            </YStack>
          )}
        </Card>

        {/* Logout */}
        <Button
          size="$5"
          borderRadius={14}
          backgroundColor="$danger"
          onPress={handleLogout}
          icon={<LogOut size={20} color="white" />}
        >
          <Text color="white" fontWeight="700" fontSize={16}>Logout</Text>
        </Button>
      </YStack>
    </YStack>
    </SafeAreaView>
  )
}
