import { Tabs, useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'tamagui'
import { SyncIndicator } from '../../src/components/SyncIndicator'
import { useSettingsStore } from '../../src/store/settings'

function CameraFAB() {
  const router = useRouter()
  const theme = useSettingsStore((s) => s.theme)
  return (
    <Pressable style={[styles.fab, { borderColor: theme === 'dark' ? '#0c1222' : '#f5f5f7' }]} onPress={() => router.push('/camera')}>
      <Text fontSize={28}>📷</Text>
    </Pressable>
  )
}

export default function TabLayout() {
  const router = useRouter()
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
              <Text fontSize={20}>⚙️</Text>
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: () => <Text fontSize={18}>📋</Text>,
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
          name="history"
          options={{
            title: 'History',
            tabBarIcon: () => <Text fontSize={18}>🕐</Text>,
            headerTitle: 'Recent History',
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
