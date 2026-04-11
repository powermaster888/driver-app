import React from 'react'
import { Card, Text, XStack, YStack } from 'tamagui'
import { Animated, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { MapPin } from 'lucide-react-native'
import { StatusBadge } from './StatusBadge'
import { CashBadge } from './CashBadge'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'
import { formatDistance } from '../utils/geo'
import type { JobSummary } from '../api/jobs'

export const JobCard = React.memo(function JobCard({ job, distanceKm }: { job: JobSummary; distanceKm?: number | null }) {
  const router = useRouter()
  const status = job.status as DeliveryStatus
  const borderColor = STATUS_COLORS[status]?.border || '#5C5E66'

  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }).start()
  }
  const onPressOut = () => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start()
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={() => router.push(`/(tabs)/jobs/${job.job_id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={`訂單 ${job.odoo_reference} ${job.customer_name}`}
        accessibilityRole="button"
      >
        <Card
          backgroundColor="$backgroundStrong"
          borderWidth={0}
          marginBottom={8}
          borderLeftWidth={3}
          borderLeftColor={borderColor}
          borderRadius={12}
          padding="$4"
        >
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack flex={1} gap={8} alignItems="flex-start">
              <Text fontSize={16} fontWeight="700" color="$color">{job.customer_name}</Text>
              {job.address && (
                <XStack alignItems="center" gap={4}>
                  <MapPin size={12} color="$muted" />
                  <Text fontSize={13} fontWeight="400" color="$colorSubtle" numberOfLines={1} flex={1}>
                    {job.address}
                  </Text>
                </XStack>
              )}
              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                <Text fontSize={11} fontWeight="400" color="$muted">
                  {job.odoo_reference}
                </Text>
                {job.collection_required && (
                  <CashBadge method={job.collection_method!} amount={job.expected_collection_amount!} />
                )}
                {distanceKm != null && (
                  <XStack backgroundColor="rgba(37,99,235,0.1)" paddingHorizontal={8} paddingVertical={2} borderRadius={9999}>
                    <Text fontSize={11} fontWeight="600" color="$primary">{formatDistance(distanceKm)}</Text>
                  </XStack>
                )}
              </XStack>
            </YStack>
            <StatusBadge status={status} />
          </XStack>
        </Card>
      </Pressable>
    </Animated.View>
  )
})
