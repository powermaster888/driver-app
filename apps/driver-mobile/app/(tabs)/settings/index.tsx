import { useState } from 'react'
import { Alert, Pressable, Switch as RNSwitch, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { YStack, XStack, Text, Card } from 'tamagui'
import { Moon, RefreshCw, LogOut, Phone, MessageCircle, FileDown } from 'lucide-react-native'
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
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <YStack flex={1} backgroundColor="$background">
        <YStack paddingHorizontal="$4" paddingTop="$4" gap="$3">
          <Text fontSize={24} fontWeight="800" color="$color" letterSpacing={-0.5}>設定</Text>
          {/* Profile card */}
          <Card padding="$5" borderWidth={1} borderColor="$borderColor" borderRadius={16} alignItems="center">
            <YStack width={64} height={64} borderRadius={9999} backgroundColor="$primary" alignItems="center" justifyContent="center">
              <Text fontSize={28} fontWeight="800" color="white">{driver?.name?.charAt(0)}</Text>
            </YStack>
            <Text fontSize={22} fontWeight="800" marginTop="$3" color="$color" letterSpacing={-0.5}>{driver?.name}</Text>
            <Text fontSize={14} fontWeight="400" color="$colorSubtle">{driver?.phone}</Text>

            {/* Stats row */}
            <XStack justifyContent="space-around" width="100%" marginTop="$4" paddingTop="$3" borderTopWidth={1} borderTopColor="$borderColor">
              <YStack alignItems="center">
                <Text fontSize={22} fontWeight="800" color="$color">{stats?.total_deliveries ?? '--'}</Text>
                <Text fontSize={10} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={0.5}>送貨次數</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontSize={22} fontWeight="800" color="$success">{stats?.on_time_rate ? `${stats.on_time_rate}%` : '--'}</Text>
                <Text fontSize={10} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={0.5}>準時率</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontSize={22} fontWeight="800" color="$color">{stats?.rating ?? '--'}</Text>
                <Text fontSize={10} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={0.5}>評分</Text>
              </YStack>
            </XStack>
          </Card>

          {/* Grouped settings card */}
          <Card borderWidth={1} borderColor="$borderColor" borderRadius={16} overflow="hidden">
            {/* Dark Mode row */}
            <XStack padding="$4" justifyContent="space-between" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack alignItems="center" gap="$3">
                <YStack width={32} height={32} borderRadius={8} backgroundColor={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} alignItems="center" justifyContent="center">
                  <Moon size={16} color={isDark ? '#F5F5F5' : '#1E293B'} />
                </YStack>
                <Text fontSize={14} fontWeight="500" color="$color">深色模式</Text>
              </XStack>
              <RNSwitch
                value={isDark}
                onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
                trackColor={{ false: '#e2e8f0', true: '#2563EB' }}
                thumbColor="white"
              />
            </XStack>

            {/* Sync Status row */}
            <XStack padding="$4" justifyContent="space-between" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack alignItems="center" gap="$3">
                <YStack width={32} height={32} borderRadius={8} backgroundColor={isDark ? 'rgba(255,255,255,0.06)' : '#f0fdf4'} alignItems="center" justifyContent="center">
                  <RefreshCw size={16} color="#22c55e" />
                </YStack>
                <YStack>
                  <Text fontSize={14} fontWeight="500" color="$color">同步狀態</Text>
                  <Text fontSize={11} color={failed.length > 0 ? '#dc2626' : '#22c55e'}>{failed.length > 0 ? `${failed.length} 個失敗` : '已全部同步'}</Text>
                </YStack>
              </XStack>
            </XStack>

            {/* Export Report row */}
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
              <XStack padding="$4" justifyContent="space-between" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
                <XStack alignItems="center" gap="$3">
                  <YStack width={32} height={32} borderRadius={8} backgroundColor={isDark ? 'rgba(255,255,255,0.06)' : '#eff6ff'} alignItems="center" justifyContent="center">
                    <FileDown size={16} color="#2563EB" />
                  </YStack>
                  <YStack>
                    <Text fontSize={14} fontWeight="500" color="$color">匯出送貨報告</Text>
                    <Text fontSize={11} color="$colorSubtle">{exporting ? '準備中...' : '最近送貨記錄 CSV'}</Text>
                  </YStack>
                </XStack>
              </XStack>
            </Pressable>

            {/* Sign Out row */}
            <Pressable onPress={handleLogout}>
              <XStack padding="$4" alignItems="center" gap="$3">
                <YStack width={32} height={32} borderRadius={8} backgroundColor={isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2'} alignItems="center" justifyContent="center">
                  <LogOut size={16} color="#dc2626" />
                </YStack>
                <Text fontSize={14} fontWeight="500" color="$danger">登出</Text>
              </XStack>
            </Pressable>
          </Card>

          {/* Contact Office */}
          <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={16}>
            <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1} marginBottom="$3">聯絡公司</Text>
            <XStack gap="$3">
              <Pressable
                onPress={() => Linking.openURL('tel:+85225206338')}
                style={{ flex: 1, backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 }}
              >
                <Phone size={20} color="#16a34a" />
                <Text fontSize={11} fontWeight="600" color="#16a34a">致電公司</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://wa.me/85225206338')}
                style={{ flex: 1, backgroundColor: isDark ? 'rgba(37,211,102,0.1)' : '#f0fdf4', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 }}
              >
                <MessageCircle size={20} color="#25D366" />
                <Text fontSize={11} fontWeight="600" color="#25D366">WhatsApp</Text>
              </Pressable>
            </XStack>
          </Card>

          <Text fontSize={11} color="#62666D" textAlign="center" marginTop="$4" paddingBottom="$6">
            v{Constants.expoConfig?.version ?? '1.0.0'} · Healthy Living Medical Supplies
          </Text>
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
