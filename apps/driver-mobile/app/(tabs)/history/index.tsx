import { FlatList, RefreshControl } from 'react-native'
import { YStack, Text } from 'tamagui'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'

export default function HistoryList() {
  const { data, refetch, isRefetching } = useJobs('recent')
  const jobs = data?.jobs || []

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.job_id)}
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$3" paddingTop="$2">
            <JobCard job={item} />
          </YStack>
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <YStack padding="$6" alignItems="center">
            <Text color="$colorSubtle">No recent deliveries</Text>
          </YStack>
        }
      />
    </YStack>
  )
}
