import { Card, Text, XStack, YStack } from 'tamagui'
import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBadge } from './StatusBadge'
import { CashBadge } from './CashBadge'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'
import type { JobSummary } from '../api/jobs'

export function JobCard({ job }: { job: JobSummary }) {
  const router = useRouter()
  const status = job.status as DeliveryStatus
  const borderColor = STATUS_COLORS[status]?.border || '#e5e7eb'

  return (
    <Pressable onPress={() => router.push(`/(tabs)/jobs/${job.job_id}`)}>
      <Card
        bordered
        padded
        marginBottom="$2"
        borderLeftWidth={4}
        borderLeftColor={borderColor}
        borderRadius={14}
        elevate
        size="$4"
      >
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1}>
            <Text fontSize={15} fontWeight="700">{job.customer_name}</Text>
            <Text fontSize={12} color="$colorSubtle" marginTop="$1">
              {job.odoo_reference} · {job.warehouse}
            </Text>
          </YStack>
          <StatusBadge status={status} />
        </XStack>
        <XStack gap="$2" marginTop="$2" flexWrap="wrap">
          {job.collection_required && (
            <CashBadge method={job.collection_method!} amount={job.expected_collection_amount!} />
          )}
          {job.address && (
            <Text fontSize={11} color="$colorSubtle" numberOfLines={1}>
              {job.address}
            </Text>
          )}
        </XStack>
      </Card>
    </Pressable>
  )
}
