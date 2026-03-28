import React from 'react'
import { Card, Text, XStack, YStack } from 'tamagui'
import { Animated, Pressable } from 'react-native'
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

  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()
  }
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start()
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={() => router.push(`/(tabs)/jobs/${job.job_id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={`Job ${job.odoo_reference} for ${job.customer_name}, status ${job.status}`}
        accessibilityRole="button"
      >
        <Card
          borderWidth={1}
          borderColor="$borderColor"
          marginBottom="$2"
          borderLeftWidth={4}
          borderLeftColor={borderColor}
          borderRadius={14}
          elevation={4}
          padding={16}
          shadowColor={borderColor}
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.08}
          shadowRadius={8}
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
    </Animated.View>
  )
})
