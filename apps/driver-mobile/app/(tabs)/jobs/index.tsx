import { FlatList, RefreshControl } from 'react-native'
import { YStack, Text } from 'tamagui'
import { Package } from 'lucide-react-native'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { JobCardSkeleton } from '../../../src/components/JobCardSkeleton'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'

export default function JobsList() {
  const { data, isLoading, refetch, isRefetching } = useJobs('pending')
  const netInfo = useNetInfo()
  const jobs = data?.jobs || []

  return (
    <YStack flex={1} backgroundColor="$background">
      {netInfo.isConnected === false && <OfflineBanner />}
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={<SummaryBar jobs={jobs} />}
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$3">
            <JobCard job={item} />
          </YStack>
        )}
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
            <YStack padding="$6" alignItems="center">
              <Package size={48} color="#94a3b8" />
              <Text color="$colorSubtle" textAlign="center" marginTop="$2">No pending deliveries</Text>
            </YStack>
          )
        }
      />
    </YStack>
  )
}
