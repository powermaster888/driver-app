import { useState } from 'react'
import { FlatList, RefreshControl, Pressable, View, Linking, TextInput, ActivityIndicator } from 'react-native'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { Package, Search, X, CalendarClock, MapPin } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { JobCardSkeleton } from '../../../src/components/JobCardSkeleton'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { useNetInfo } from '@react-native-community/netinfo'
import { useAuthStore } from '../../../src/store/auth'
import { useLocationSort } from '../../../src/hooks/useLocationSort'
import { formatDistance } from '../../../src/utils/geo'
import type { DeliveryStatus } from '../../../src/theme/status-colors'

export default function JobsList() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useJobs('pending')
  const { data: upcomingData } = useJobs('upcoming')
  const futureJobs = upcomingData?.jobs || []
  const netInfo = useNetInfo()
  const router = useRouter()
  const driver = useAuthStore((s) => s.driver)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortByDistance, setSortByDistance] = useState(false)
  const jobs = data?.jobs || []
  const theme = useTheme()

  const activeJob = jobs.find((j) => ['on_the_way', 'arrived'].includes(j.status))
  const upcomingJobs = jobs.filter((j) => ['assigned', 'accepted'].includes(j.status))
  const otherInProgress = jobs.filter((j) => ['on_the_way', 'arrived'].includes(j.status) && (!activeJob || j.job_id !== activeJob.job_id))
  const rawListJobs = [...otherInProgress, ...upcomingJobs]

  const { sortedJobs, hasLocation } = useLocationSort(rawListJobs)
  const listJobs = sortByDistance && hasLocation ? sortedJobs : rawListJobs

  const filteredListJobs = searchQuery.length > 0
    ? listJobs.filter((j) => {
        const q = searchQuery.toLowerCase()
        return (
          j.customer_name.toLowerCase().includes(q) ||
          j.odoo_reference.toLowerCase().includes(q) ||
          (j.address || '').toLowerCase().includes(q) ||
          (j.sales_order_ref || '').toLowerCase().includes(q)
        )
      })
    : listJobs

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'

  const handleWhatsApp = () => {
    if (!activeJob?.phone) return
    const clean = activeJob.phone.replace(/[\s\-()]/g, '').replace(/^\+/, '')
    Linking.openURL(`https://wa.me/${clean}`)
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {netInfo.isConnected === false && <OfflineBanner />}
      {isError && (
        <YStack padding="$4" backgroundColor="rgba(239,68,68,0.1)" margin="$3" borderRadius={12}>
          <Text fontSize={13} fontWeight="600" color="$danger">載入失敗</Text>
          <Text fontSize={12} color="$colorSubtle" marginTop="$1">{error?.message || '請下拉重試'}</Text>
        </YStack>
      )}
      <FlatList
        data={filteredListJobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={
          <YStack>
            {/* Greeting header */}
            <YStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
              <Text fontSize={14} color="$muted" fontWeight="400">{greeting}</Text>
              <XStack alignItems="baseline" gap="$2" marginTop={4}>
                <Text fontSize={24} fontWeight="800" color="$color" letterSpacing={-0.5}>{driver?.name || '司機'}</Text>
                <Text fontSize={13} color="$muted" fontWeight="400">· 今日 {jobs.length} 單</Text>
              </XStack>
            </YStack>

            {/* Search bar + sort toggle */}
            <XStack paddingHorizontal="$4" paddingBottom="$2" gap="$2">
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: theme.backgroundStrong?.val,
                borderRadius: 8, paddingHorizontal: 12, height: 44,
              }}>
                <Search size={18} color={theme.muted?.val} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="搜尋客戶、訂單..."
                  placeholderTextColor={theme.muted?.val}
                  style={{ flex: 1, marginLeft: 8, fontSize: 14, color: theme.color?.val }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <X size={16} color={theme.muted?.val} />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => setSortByDistance((v) => !v)}
                accessibilityLabel={sortByDistance ? '按時間排序' : '按距離排序'}
                accessibilityRole="button"
                style={{
                  width: 44, height: 44, borderRadius: 8,
                  backgroundColor: sortByDistance ? theme.primary?.val : theme.backgroundStrong?.val,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <MapPin size={20} color={sortByDistance ? '#fff' : theme.muted?.val} />
              </Pressable>
            </XStack>

            {searchQuery.length === 0 && (
              <>
                {/* Summary bar */}
                {isLoading ? (
                  <XStack padding="$3" justifyContent="center">
                    <ActivityIndicator size="small" color={theme.primary?.val} />
                  </XStack>
                ) : (
                  <SummaryBar jobs={jobs} />
                )}

                {/* Active job hero card */}
                {activeJob && (
                  <Pressable onPress={() => router.push(`/(tabs)/jobs/${activeJob.job_id}`)}>
                    <View style={{
                      marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 18,
                      backgroundColor: theme.backgroundStrong?.val,
                      borderLeftWidth: 4,
                      borderLeftColor: theme.primary?.val,
                    }}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={10} color="$muted" fontWeight="700" textTransform="uppercase" letterSpacing={1}>進行中</Text>
                        <StatusBadge status={activeJob.status as DeliveryStatus} />
                      </XStack>
                      <Text fontSize={18} fontWeight="700" color="$color" marginTop="$2">{activeJob.customer_name}</Text>
                      <Text fontSize={13} fontWeight="400" color="$colorSubtle" marginTop={4}>
                        {activeJob.odoo_reference} · {activeJob.address || activeJob.warehouse}
                      </Text>
                      <XStack gap="$2" marginTop="$3">
                        <Pressable
                          onPress={() => router.push(`/jobs/${activeJob.job_id}/complete`)}
                          style={{ flex: 1, backgroundColor: theme.primary?.val, borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                        >
                          <Text fontSize={14} fontWeight="600" color="white">完成送貨</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleWhatsApp}
                          style={{ flex: 1, backgroundColor: theme.borderColor?.val, borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                        >
                          <Text fontSize={14} fontWeight="600" color="$color">WhatsApp</Text>
                        </Pressable>
                      </XStack>
                    </View>
                  </Pressable>
                )}
              </>
            )}

            {/* Section header or loading */}
            {isLoading ? (
              <YStack paddingHorizontal="$4" paddingTop="$4">
                <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5} marginBottom="$2">載入中...</Text>
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </YStack>
            ) : filteredListJobs.length > 0 ? (
              <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
                <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>
                  {searchQuery.length > 0 ? `搜尋結果 (${filteredListJobs.length})` : `待送 (${listJobs.length})`}
                </Text>
              </XStack>
            ) : null}
          </YStack>
        }
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$4">
            <JobCard job={item} distanceKm={sortByDistance && 'distanceKm' in item ? (item as any).distanceKm : undefined} />
          </YStack>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListFooterComponent={
          futureJobs.length > 0 ? (
            <YStack paddingHorizontal="$4" paddingTop="$4" paddingBottom={100}>
              <XStack alignItems="center" gap="$2" marginBottom="$2">
                <CalendarClock size={14} color={theme.muted?.val} />
                <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>
                  即將到來 ({futureJobs.length})
                </Text>
              </XStack>
              {futureJobs.slice(0, 5).map((j) => (
                <XStack key={j.job_id} padding="$3" backgroundColor="$backgroundStrong" borderRadius={12} marginBottom={6} alignItems="center" gap="$3" opacity={0.7}>
                  <View style={{ width: 3, height: 32, borderRadius: 2, backgroundColor: theme.muted?.val }} />
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color="$color">{j.customer_name}</Text>
                    <Text fontSize={12} color="$muted">{j.odoo_reference} · {j.warehouse} · {new Date(j.scheduled_date).toLocaleDateString('zh-HK', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  </YStack>
                </XStack>
              ))}
              {futureJobs.length > 5 && (
                <Text fontSize={12} color="$muted" textAlign="center" marginTop="$1">+{futureJobs.length - 5} 更多</Text>
              )}
            </YStack>
          ) : (
            <YStack height={100} />
          )
        }
        ListEmptyComponent={
          isLoading ? (
            <YStack paddingHorizontal="$3" paddingTop="$2">
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
            </YStack>
          ) : (
            <YStack padding="$6" alignItems="center" gap="$3">
              <YStack width={80} height={80} borderRadius={40} backgroundColor="$backgroundStrong" alignItems="center" justifyContent="center">
                <Package size={36} color={theme.muted?.val} />
              </YStack>
              <Text fontSize={17} fontWeight="700" color="$color">全部完成！</Text>
              <Text color="$colorSubtle" textAlign="center" fontSize={14}>沒有待送訂單，下拉可重新整理</Text>
            </YStack>
          )
        }
      />
    </YStack>
  )
}
