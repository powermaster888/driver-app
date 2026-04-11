import { useState } from 'react'
import { FlatList, RefreshControl, Pressable, View, Linking, TextInput, ActivityIndicator } from 'react-native'
import { YStack, XStack, Text } from 'tamagui'
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
    <YStack flex={1} backgroundColor="#050505">
      {netInfo.isConnected === false && <OfflineBanner />}
      {isError && (
        <YStack padding="$4" backgroundColor="rgba(239,68,68,0.1)" margin="$3" borderRadius={12}>
          <Text fontSize={13} fontWeight="600" color="#EF4444">載入失敗</Text>
          <Text fontSize={12} color="#8B8D94" marginTop="$1">{error?.message || '請下拉重試'}</Text>
        </YStack>
      )}
      <FlatList
        data={filteredListJobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={
          <YStack>
            {/* Greeting header */}
            <YStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
              <Text fontSize={14} color="#5C5E66" fontWeight="400">{greeting}</Text>
              <XStack alignItems="baseline" gap="$2" marginTop={4}>
                <Text fontSize={24} fontWeight="800" color="#EDEDEF" letterSpacing={-0.5}>{driver?.name || '司機'}</Text>
                <Text fontSize={13} color="#5C5E66" fontWeight="400">· 今日 {jobs.length} 單</Text>
              </XStack>
            </YStack>

            {/* Search bar + sort toggle */}
            <XStack paddingHorizontal="$4" paddingBottom="$2" gap="$2">
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#111111',
                borderRadius: 8, paddingHorizontal: 12, height: 44,
              }}>
                <Search size={18} color="#5C5E66" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="搜尋客戶、訂單..."
                  placeholderTextColor="#5C5E66"
                  style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#EDEDEF' }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <X size={16} color="#5C5E66" />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => setSortByDistance((v) => !v)}
                accessibilityLabel={sortByDistance ? '按時間排序' : '按距離排序'}
                accessibilityRole="button"
                style={{
                  width: 44, height: 44, borderRadius: 8,
                  backgroundColor: sortByDistance ? '#2563EB' : '#111111',
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <MapPin size={20} color={sortByDistance ? '#fff' : '#5C5E66'} />
              </Pressable>
            </XStack>

            {searchQuery.length === 0 && (
              <>
                {/* Summary bar */}
                {isLoading ? (
                  <XStack padding="$3" justifyContent="center">
                    <ActivityIndicator size="small" color="#2563EB" />
                  </XStack>
                ) : (
                  <SummaryBar jobs={jobs} />
                )}

                {/* Active job hero card */}
                {activeJob && (
                  <Pressable onPress={() => router.push(`/(tabs)/jobs/${activeJob.job_id}`)}>
                    <View style={{
                      marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 18,
                      backgroundColor: '#111111',
                      borderLeftWidth: 4,
                      borderLeftColor: '#2563EB',
                    }}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={10} color="#5C5E66" fontWeight="700" textTransform="uppercase" letterSpacing={1}>進行中</Text>
                        <StatusBadge status={activeJob.status as DeliveryStatus} />
                      </XStack>
                      <Text fontSize={18} fontWeight="700" color="#EDEDEF" marginTop="$2">{activeJob.customer_name}</Text>
                      <Text fontSize={13} fontWeight="400" color="#8B8D94" marginTop={4}>
                        {activeJob.odoo_reference} · {activeJob.address || activeJob.warehouse}
                      </Text>
                      <XStack gap="$2" marginTop="$3">
                        <Pressable
                          onPress={() => router.push(`/jobs/${activeJob.job_id}/complete`)}
                          style={{ flex: 1, backgroundColor: '#2563EB', borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                        >
                          <Text fontSize={14} fontWeight="600" color="white">完成送貨</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleWhatsApp}
                          style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                        >
                          <Text fontSize={14} fontWeight="600" color="#EDEDEF">WhatsApp</Text>
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
                <Text fontSize={12} fontWeight="600" color="#5C5E66" textTransform="uppercase" letterSpacing={0.5} marginBottom="$2">載入中...</Text>
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </YStack>
            ) : filteredListJobs.length > 0 ? (
              <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
                <Text fontSize={12} fontWeight="600" color="#5C5E66" textTransform="uppercase" letterSpacing={0.5}>
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
                <CalendarClock size={14} color="#5C5E66" />
                <Text fontSize={12} fontWeight="600" color="#5C5E66" textTransform="uppercase" letterSpacing={0.5}>
                  即將到來 ({futureJobs.length})
                </Text>
              </XStack>
              {futureJobs.slice(0, 5).map((j) => (
                <XStack key={j.job_id} padding="$3" backgroundColor="#111111" borderRadius={12} marginBottom={6} alignItems="center" gap="$3" opacity={0.7}>
                  <View style={{ width: 3, height: 32, borderRadius: 2, backgroundColor: '#5C5E66' }} />
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color="#EDEDEF">{j.customer_name}</Text>
                    <Text fontSize={12} color="#5C5E66">{j.odoo_reference} · {j.warehouse} · {new Date(j.scheduled_date).toLocaleDateString('zh-HK', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  </YStack>
                </XStack>
              ))}
              {futureJobs.length > 5 && (
                <Text fontSize={12} color="#5C5E66" textAlign="center" marginTop="$1">+{futureJobs.length - 5} 更多</Text>
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
              <YStack width={80} height={80} borderRadius={40} backgroundColor="#111111" alignItems="center" justifyContent="center">
                <Package size={36} color="#5C5E66" />
              </YStack>
              <Text fontSize={17} fontWeight="700" color="#EDEDEF">全部完成！</Text>
              <Text color="#8B8D94" textAlign="center" fontSize={14}>沒有待送訂單，下拉可重新整理</Text>
            </YStack>
          )
        }
      />
    </YStack>
  )
}
