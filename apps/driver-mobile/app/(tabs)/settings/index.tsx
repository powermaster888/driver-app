import { useState } from 'react'
import { Alert, Pressable, Switch as RNSwitch, Linking, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { YStack, XStack, Text } from 'tamagui'
import { Moon, RefreshCw, LogOut, Phone, MessageCircle, FileDown, ChevronRight } from 'lucide-react-native'
import Constants from 'expo-constants'
import { useAuthStore } from '../../../src/store/auth'
import { useDriverStats, useJobs } from '../../../src/api/jobs'
import { useSettingsStore } from '../../../src/store/settings'
import { useQueueStore } from '../../../src/store/queue'
import { showToast, triggerHaptic } from '../../../src/utils/feedback'
import { exportJobsCSV } from '../../../src/utils/csv-export'

export default function SettingsTab() {
  const router = useRouter()
  const { driver, clearAuth } = useAuthStore()
  const { data: stats } = useDriverStats()
  const { data: recentData } = useJobs('recent')
  const { theme, setTheme } = useSettingsStore()
  const [exporting, setExporting] = useState(false)
  const actions = useQueueStore((s) => s.actions)
  const pending = actions.filter((a) => a.status === 'queued' || a.status === 'syncing')
  const failed = actions.filter((a) => a.status === 'failed')
  const isDark = theme === 'dark'

  const handleLogout = async () => {
    if (pending.length > 0 || failed.length > 0) {
      Alert.alert(
        '未同步操作',
        `您有 ${pending.length + failed.length} 個未同步操作。請先同步或強制登出。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '強制登出',
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
      Alert.alert('登出', '確定要登出嗎？', [
        { text: '取消', style: 'cancel' },
        {
          text: '登出',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }} edges={['bottom']}>
      <ScrollView style={{ flex: 1, backgroundColor: '#050505' }}>
        <YStack paddingHorizontal={16} paddingTop={16} gap={16} paddingBottom={40}>
          <Text fontSize={24} fontWeight="800" color="#EDEDEF" letterSpacing={-0.5}>設定</Text>

          {/* Profile card */}
          <View style={{ backgroundColor: '#111111', borderRadius: 12, padding: 20, alignItems: 'center' }}>
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: '#2563EB',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text fontSize={20} fontWeight="800" color="white">{driver?.name?.charAt(0)}</Text>
            </View>
            <Text fontSize={18} fontWeight="700" color="#EDEDEF" marginTop={12}>{driver?.name}</Text>
            <Text fontSize={14} fontWeight="400" color="#8B8D94" marginTop={4}>{driver?.phone}</Text>

            {/* Stats row */}
            <XStack justifyContent="space-around" width="100%" marginTop={16} paddingTop={16} borderTopWidth={1} borderTopColor="rgba(255,255,255,0.08)">
              <YStack alignItems="center">
                <Text fontSize={22} fontWeight="800" color="#EDEDEF">{stats?.total_deliveries ?? '--'}</Text>
                <Text fontSize={10} fontWeight="500" color="#5C5E66" marginTop={2}>送貨次數</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontSize={22} fontWeight="800" color="#22C55E">{stats?.on_time_rate ? `${stats.on_time_rate}%` : '--'}</Text>
                <Text fontSize={10} fontWeight="500" color="#5C5E66" marginTop={2}>準時率</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontSize={22} fontWeight="800" color="#EDEDEF">{stats?.rating ?? '--'}</Text>
                <Text fontSize={10} fontWeight="500" color="#5C5E66" marginTop={2}>評分</Text>
              </YStack>
            </XStack>
          </View>

          {/* Grouped settings */}
          <View style={{ backgroundColor: '#111111', borderRadius: 12, overflow: 'hidden' }}>
            {/* Dark Mode */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <XStack alignItems="center" gap={12}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                  <Moon size={16} color="#EDEDEF" />
                </View>
                <Text fontSize={14} fontWeight="500" color="#EDEDEF">深色模式</Text>
              </XStack>
              <RNSwitch
                value={isDark}
                onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
                trackColor={{ false: 'rgba(255,255,255,0.08)', true: '#2563EB' }}
                thumbColor="white"
              />
            </View>

            {/* Sync Status */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <XStack alignItems="center" gap={12}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                  <RefreshCw size={16} color="#22C55E" />
                </View>
                <YStack>
                  <Text fontSize={14} fontWeight="500" color="#EDEDEF">同步狀態</Text>
                  <XStack alignItems="center" gap={6} marginTop={2}>
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: failed.length > 0 ? '#F59E0B' : '#22C55E',
                    }} />
                    <Text fontSize={11} color={failed.length > 0 ? '#F59E0B' : '#22C55E'}>
                      {failed.length > 0 ? `${failed.length} 個失敗` : '已全部同步'}
                    </Text>
                  </XStack>
                </YStack>
              </XStack>
            </View>

            {/* Export Report */}
            <Pressable
              onPress={async () => {
                const jobs = recentData?.jobs
                if (!jobs || jobs.length === 0) {
                  showToast('沒有最近的送貨記錄可匯出', 'info')
                  return
                }
                setExporting(true)
                try {
                  await exportJobsCSV(jobs)
                  showToast('報告已匯出', 'success')
                } catch {
                  showToast('匯出失敗', 'error')
                } finally {
                  setExporting(false)
                }
              }}
              disabled={exporting}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                <XStack alignItems="center" gap={12}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }}>
                    <FileDown size={16} color="#2563EB" />
                  </View>
                  <YStack>
                    <Text fontSize={14} fontWeight="500" color="#EDEDEF">匯出報告</Text>
                    <Text fontSize={11} color="#5C5E66">{exporting ? '準備中...' : '最近送貨記錄 CSV'}</Text>
                  </YStack>
                </XStack>
                <ChevronRight size={16} color="#5C5E66" />
              </View>
            </Pressable>

            {/* Sign Out */}
            <Pressable onPress={handleLogout}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  <LogOut size={16} color="#EF4444" />
                </View>
                <Text fontSize={14} fontWeight="500" color="#EF4444">登出</Text>
              </View>
            </Pressable>
          </View>

          {/* Contact Office */}
          <View style={{ backgroundColor: '#111111', borderRadius: 12, padding: 16 }}>
            <Text fontSize={12} fontWeight="600" color="#5C5E66" textTransform="uppercase" letterSpacing={1} marginBottom={12}>聯絡公司</Text>
            <XStack gap={12}>
              <Pressable
                onPress={() => Linking.openURL('tel:+85225206338')}
                style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 }}
              >
                <Phone size={20} color="#22C55E" />
                <Text fontSize={11} fontWeight="600" color="#22C55E">致電辦公室</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://wa.me/85225206338')}
                style={{ flex: 1, backgroundColor: 'rgba(37,211,102,0.1)', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 }}
              >
                <MessageCircle size={20} color="#25D366" />
                <Text fontSize={11} fontWeight="600" color="#25D366">WhatsApp</Text>
              </Pressable>
            </XStack>
          </View>

          <Text fontSize={11} color="#5C5E66" textAlign="center" marginTop={8}>
            v{Constants.expoConfig?.version ?? '1.0.0'} · 盈康醫療用品有限公司
          </Text>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  )
}
