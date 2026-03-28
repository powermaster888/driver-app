import { FlatList, RefreshControl } from 'react-native'
import { YStack, XStack, Text } from 'tamagui'
import { Package } from 'lucide-react-native'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { JobCardSkeleton } from '../../../src/components/JobCardSkeleton'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'

export default function JobsList() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useJobs('pending')
  const netInfo = useNetInfo()
  const jobs = data?.jobs || []

  const inProgress = jobs.filter((j) => ['on_the_way', 'arrived'].includes(j.status))
  const upcoming = jobs.filter((j) => ['assigned', 'accepted'].includes(j.status))
  const sortedJobs = [...inProgress, ...upcoming]

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
        ListHeaderComponent={<SummaryBar jobs={jobs} />}
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
