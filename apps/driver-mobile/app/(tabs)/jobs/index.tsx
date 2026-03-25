import { FlatList, RefreshControl } from 'react-native'
import { YStack, Text } from 'tamagui'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'

export default function JobsList() {
  const { data, isLoading, refetch, isRefetching } = useJobs('today')
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
          !isLoading ? (
            <YStack padding="$6" alignItems="center">
              <Text fontSize={48} marginBottom="$2">📦</Text>
              <Text color="$colorSubtle" textAlign="center">No deliveries assigned for today</Text>
            </YStack>
          ) : null
        }
      />
    </YStack>
  )
}
