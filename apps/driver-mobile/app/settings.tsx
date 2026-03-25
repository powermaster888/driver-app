import { Alert } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { YStack, XStack, Text, Card, Switch, Button, Separator } from 'tamagui'
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
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: 'Settings' }} />
      <YStack padding="$4" gap="$4">
        {/* Driver info */}
        <Card padded bordered borderRadius={14}>
          <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Driver</Text>
          <Text fontSize={18} fontWeight="700" marginTop="$1">{driver?.name}</Text>
          <Text fontSize={13} color="$colorSubtle">{driver?.phone}</Text>
        </Card>

        {/* Theme */}
        <Card padded bordered borderRadius={14}>
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize={14} fontWeight="600">Dark Mode</Text>
              <Text fontSize={12} color="$colorSubtle">Switch to dark theme</Text>
            </YStack>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            >
              <Switch.Thumb />
            </Switch>
          </XStack>
        </Card>

        {/* Sync status */}
        <Card padded bordered borderRadius={14}>
          <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Sync Status</Text>
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
          color="white"
          fontWeight="700"
          onPress={handleLogout}
        >
          Logout
        </Button>
      </YStack>
    </YStack>
  )
}
