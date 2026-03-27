import { Tabs, useRouter, usePathname } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'tamagui'
import { ClipboardList, Clock, Camera, Settings } from 'lucide-react-native'
import { SyncIndicator } from '../../src/components/SyncIndicator'
import { useSettingsStore } from '../../src/store/settings'

function CameraFAB() {
  const router = useRouter()
  const theme = useSettingsStore((s) => s.theme)
  const pathname = usePathname()

  // Only show FAB on list screens, not on detail screens
  const isListScreen = pathname === '/jobs' || pathname === '/jobs/' || pathname === '/history' || pathname === '/history/'
  if (!isListScreen) return null

  return (
    <Pressable style={[styles.fab, { borderColor: theme === 'dark' ? '#0c1222' : '#f5f5f7' }]} onPress={() => router.push('/camera')}>
      <Camera size={28} color="white" />
    </Pressable>
  )
}

export default function TabLayout() {
  const router = useRouter()
  const theme = useSettingsStore((s) => s.theme)
  const iconColor = theme === 'dark' ? '#F1F5F9' : '#1E293B'

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
              <Settings size={22} color={iconColor} />
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="jobs/index"
          options={{
            title: 'Jobs',
            tabBarLabel: 'Jobs',
            tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />,
            headerTitle: 'My Jobs',
            headerLeft: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                <Text fontSize={16} fontWeight="800">Healthy Living</Text>
                <SyncIndicator />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="jobs/[id]"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="history/index"
          options={{
            title: 'History',
            tabBarLabel: 'History',
            tabBarIcon: ({ color }) => <Clock size={22} color={color} />,
            headerTitle: 'Recent History',
          }}
        />
        <Tabs.Screen
          name="history/[id]"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>
      <CameraFAB />
    </View>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
    borderWidth: 4,
  },
})
