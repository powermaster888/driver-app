import React from 'react'
import { Card, Text, XStack, YStack } from 'tamagui'
import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, MapPin } from 'lucide-react-native'
import { StatusBadge } from './StatusBadge'
import { CashBadge } from './CashBadge'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'
import type { JobSummary } from '../api/jobs'

export const JobCard = React.memo(function JobCard({ job }: { job: JobSummary }) {
  const router = useRouter()
  const status = job.status as DeliveryStatus
  const borderColor = STATUS_COLORS[status]?.border || '#e5e7eb'

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/jobs/${job.job_id}`)}
      accessibilityLabel={`Job ${job.odoo_reference} for ${job.customer_name}, status ${job.status}`}
      accessibilityRole="button"
    >
      <Card
        bordered
        marginBottom="$2"
        borderLeftWidth={4}
        borderLeftColor={borderColor}
        borderRadius={14}
        elevate
        padding={16}
      >
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1} gap={12} alignItems="flex-start">
            <YStack alignItems="flex-start">
              <Text fontSize={15} fontWeight="700" textAlign="left">{job.customer_name}</Text>
              <Text fontSize={12} color="$colorSubtle" marginTop="$1" textAlign="left">
                {job.odoo_reference} · {job.warehouse}
              </Text>
            </YStack>
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              {job.collection_required && (
                <CashBadge method={job.collection_method!} amount={job.expected_collection_amount!} />
              )}
              {job.address && (
                <XStack alignItems="center" gap={4}>
                  <MapPin size={12} color="#94a3b8" />
                  <Text fontSize={11} color="$colorSubtle" numberOfLines={1} flex={1}>
                    {job.address}
                  </Text>
                </XStack>
              )}
            </XStack>
          </YStack>
          <XStack alignItems="center" gap={8}>
            <StatusBadge status={status} />
            <ChevronRight size={16} color="#94a3b8" />
          </XStack>
        </XStack>
      </Card>
    </Pressable>
  )
})
