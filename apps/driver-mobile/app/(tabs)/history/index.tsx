import { FlatList, RefreshControl } from 'react-native'
import { YStack, Text } from 'tamagui'
import { Package } from 'lucide-react-native'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'

export default function HistoryList() {
  const { data, isError, error, refetch, isRefetching } = useJobs('recent')
  const jobs = data?.jobs || []

  return (
    <YStack flex={1} backgroundColor="$background">
      {isError && (
        <YStack padding="$4" backgroundColor="#fef2f2" margin="$3" borderRadius={12}>
          <Text fontSize={13} fontWeight="600" color="#dc2626">Failed to load jobs</Text>
          <Text fontSize={12} color="#6b7280" marginTop="$1">{error?.message || 'Please pull down to retry'}</Text>
        </YStack>
      )}
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
            <Package size={48} color="#94a3b8" />
            <Text color="$colorSubtle" marginTop="$2">No recent deliveries</Text>
          </YStack>
        }
      />
    </YStack>
  )
}
