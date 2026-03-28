import { FlatList, RefreshControl, Pressable, View } from 'react-native'
import { YStack, XStack, Text } from 'tamagui'
import { Package } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { JobCardSkeleton } from '../../../src/components/JobCardSkeleton'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'
import { useAuthStore } from '../../../src/store/auth'

function ProgressRing({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <YStack alignItems="center">
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        borderWidth: 4, borderColor: '#e2e8f0',
        borderTopColor: value > 0 ? color : '#e2e8f0',
        borderRightColor: value > max * 0.25 ? color : '#e2e8f0',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text fontSize={17} fontWeight="800" color={value > 0 ? color : '$color'}>{value}</Text>
      </View>
      <Text fontSize={10} color="$colorSubtle" marginTop="$1">{label}</Text>
    </YStack>
  )
}

export default function JobsList() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useJobs('pending')
  const netInfo = useNetInfo()
  const router = useRouter()
  const driver = useAuthStore((s) => s.driver)
  const jobs = data?.jobs || []

  const inProgress = jobs.filter((j) => ['on_the_way', 'arrived'].includes(j.status))
  const upcoming = jobs.filter((j) => ['assigned', 'accepted'].includes(j.status))
  const delivered = jobs.filter((j) => j.status === 'delivered')
  const failed = jobs.filter((j) => j.status === 'failed')

  const activeJob = jobs.find((j) => ['on_the_way', 'arrived'].includes(j.status))
  const sortedJobs = [...inProgress, ...upcoming].filter((j) => !activeJob || j.job_id !== activeJob.job_id)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <YStack flex={1} backgroundColor="$background">
      {netInfo.isConnected === false && <OfflineBanner />}
      {isError && (
        <YStack padding="$4" backgroundColor="#fef2f2" margin="$3" borderRadius={12}>
          <Text fontSize={13} fontWeight="600" color="#dc2626">Failed to load jobs</Text>
          <Text fontSize={12} color="#6b7280" marginTop="$1">{error?.message || 'Please pull down to retry'}</Text>
        </YStack>
      )}
      <FlatList
        data={sortedJobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={
          <YStack>
            {/* Greeting header */}
            <XStack padding="$4" paddingBottom="$2" alignItems="center" gap="$3">
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
              }}>
                <Text fontSize={18} fontWeight="800" color="white">{driver?.name?.charAt(0) || '?'}</Text>
              </View>
              <YStack flex={1}>
                <Text fontSize={18} fontWeight="800">{greeting}, {driver?.name || 'Driver'}</Text>
                <Text fontSize={13} color="$colorSubtle">{jobs.length} job{jobs.length !== 1 ? 's' : ''} today</Text>
              </YStack>
            </XStack>

            {/* Progress rings */}
            <XStack justifyContent="space-around" paddingHorizontal="$4" paddingVertical="$3">
              <ProgressRing value={inProgress.length} max={jobs.length} color="#2563eb" label="Active" />
              <ProgressRing value={upcoming.length} max={jobs.length} color="#F97316" label="Upcoming" />
              <ProgressRing value={delivered.length} max={jobs.length} color="#22c55e" label="Delivered" />
              <ProgressRing value={failed.length} max={jobs.length} color="#dc2626" label="Failed" />
            </XStack>

            {/* Active job hero card */}
            {activeJob && (
              <Pressable onPress={() => router.push(`/(tabs)/jobs/${activeJob.job_id}`)}>
                <View style={{
                  marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 16,
                  backgroundColor: activeJob.status === 'arrived' ? '#7c3aed' : '#2563eb',
                }}>
                  <XStack justifyContent="space-between">
                    <Text fontSize={10} color="rgba(255,255,255,0.8)" textTransform="uppercase" letterSpacing={1}>Now Active</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                      <Text fontSize={9} color="white" fontWeight="700">{activeJob.status.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                  </XStack>
                  <Text fontSize={17} fontWeight="700" color="white" marginTop="$1">{activeJob.customer_name}</Text>
                  <Text fontSize={11} color="rgba(255,255,255,0.7)" marginTop="$1">{activeJob.odoo_reference} · {activeJob.address || activeJob.warehouse}</Text>
                </View>
              </Pressable>
            )}
          </YStack>
        }
        renderItem={({ item, index }) => {
          const isInProgress = ['on_the_way', 'arrived'].includes(item.status)
          const prevItem = index > 0 ? sortedJobs[index - 1] : null
          const prevIsInProgress = prevItem ? ['on_the_way', 'arrived'].includes(prevItem.status) : null
          const showHeader = index === 0 || (isInProgress !== prevIsInProgress)

          return (
            <YStack paddingHorizontal="$3">
              {showHeader && (
                <XStack alignItems="center" gap="$2" marginTop={index > 0 ? '$3' : '$1'} marginBottom="$2">
                  <YStack height={1} flex={1} backgroundColor="$borderColor" />
                  <Text fontSize={11} fontWeight="700" color="$colorSubtle" textTransform="uppercase" letterSpacing={1}>
                    {isInProgress ? 'In Progress' : 'Upcoming'}
                  </Text>
                  <YStack height={1} flex={1} backgroundColor="$borderColor" />
                </XStack>
              )}
              <JobCard job={item} />
            </YStack>
          )
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
              <YStack width={80} height={80} borderRadius={40} backgroundColor="$backgroundStrong" alignItems="center" justifyContent="center" borderWidth={1} borderColor="$borderColor">
                <Package size={36} color="#94a3b8" />
              </YStack>
              <Text fontSize={16} fontWeight="700" color="$color">All Clear!</Text>
              <Text color="$colorSubtle" textAlign="center" fontSize={13}>No pending deliveries. Pull down to refresh.</Text>
            </YStack>
          )
        }
      />
    </YStack>
  )
}
