import React, { useState } from 'react'
import { Tabs, useRouter, usePathname } from 'expo-router'
import { Animated, Pressable, StyleSheet, View, Modal } from 'react-native'
import { Text } from 'tamagui'
import { ClipboardList, Camera, Settings, CalendarDays, QrCode } from 'lucide-react-native'
import { useSettingsStore } from '../../src/store/settings'

function CameraFAB() {
  const router = useRouter()
  const pathname = usePathname()
  const pulseAnim = React.useRef(new Animated.Value(1)).current
  const scaleAnim = React.useRef(new Animated.Value(1)).current
  const [showMenu, setShowMenu] = useState(false)

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
    Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }).start()
  }
  const onPressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start()
  }

  return (
    <>
      <View style={styles.fabContainer}>
        <Animated.View style={[styles.fabPulse, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            style={styles.fab}
            onPress={() => setShowMenu(true)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityLabel="掃描"
            accessibilityRole="button"
          >
            <QrCode size={26} color="white" />
          </Pressable>
        </Animated.View>
      </View>

      {showMenu && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setShowMenu(false)}>
            <View style={{
              position: 'absolute', bottom: 120, alignSelf: 'center',
              backgroundColor: '#111111',
              borderRadius: 12, padding: 6, width: 220,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}>
              <Pressable
                onPress={() => { setShowMenu(false); router.push('/scanner') }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 8 }}
              >
                <QrCode size={18} color="#2563EB" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#EDEDEF' }}>掃描條碼</Text>
              </Pressable>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 8 }} />
              <Pressable
                onPress={() => { setShowMenu(false); router.push('/camera') }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 8 }}
              >
                <Camera size={18} color="#8B8D94" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#EDEDEF' }}>拍照</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  )
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#5C5E66',
          tabBarStyle: {
            height: 64,
            paddingTop: 6,
            paddingBottom: 6,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
            elevation: 0,
            shadowOpacity: 0,
            backgroundColor: '#0A0A0A',
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
            letterSpacing: 0.3,
          },
        }}
      >
        <Tabs.Screen
          name="jobs/index"
          options={{
            title: '送貨',
            tabBarIcon: ({ color }) => <ClipboardList size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="jobs/[id]"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="history/index"
          options={{
            title: '日曆',
            tabBarIcon: ({ color }) => <CalendarDays size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="history/[id]"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="settings/index"
          options={{
            title: '設定',
            tabBarIcon: ({ color }) => <Settings size={20} color={color} />,
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
    bottom: 48,
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
    borderColor: 'rgba(37,99,235,0.3)',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#050505',
  },
})
