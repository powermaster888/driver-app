import React from 'react'
import { Tabs, useRouter, usePathname } from 'expo-router'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'tamagui'
import { ClipboardList, Clock, Camera, Settings } from 'lucide-react-native'
import { SyncIndicator } from '../../src/components/SyncIndicator'
import { Logo } from '../../src/components/Logo'
import { useSettingsStore } from '../../src/store/settings'

function CameraFAB() {
  const router = useRouter()
  const theme = useSettingsStore((s) => s.theme)
  const pathname = usePathname()
  const pulseAnim = React.useRef(new Animated.Value(1)).current
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const isListScreen = pathname === '/jobs' || pathname === '/jobs/' || pathname === '/history' || pathname === '/history/'

  React.useEffect(() => {
    if (!isListScreen) return
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [isListScreen])

  if (!isListScreen) return null

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, speed: 50 }).start()
  }
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start()
  }

  return (
    <View style={styles.fabContainer}>
      <Animated.View style={[styles.fabPulse, { transform: [{ scale: pulseAnim }], borderColor: theme === 'dark' ? 'rgba(37,99,235,0.3)' : 'rgba(37,99,235,0.2)' }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          style={[styles.fab, { borderColor: theme === 'dark' ? '#0c1222' : '#f5f5f7' }]}
          onPress={() => router.push('/camera')}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityLabel="Take photo"
          accessibilityRole="button"
        >
          <Camera size={28} color="white" />
        </Pressable>
      </Animated.View>
    </View>
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
            <Pressable
              onPress={() => router.push('/settings')}
              style={{ marginRight: 16, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
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
                <Logo height={28} />
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
  fabContainer: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fabPulse: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  fab: {
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
    borderWidth: 4,
  },
})
