import { ScrollView, Linking, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner, Button } from 'tamagui'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { ActionButton } from '../../../src/components/ActionButton'
import { CashBadge } from '../../../src/components/CashBadge'
import { updateStatus } from '../../../src/api/status'
import { useQueueStore } from '../../../src/store/queue'
import { generateActionId } from '../../../src/utils/uuid'
import { stripHtml } from '../../../src/utils/html'
import type { DeliveryStatus } from '../../../src/theme/status-colors'

const STATUS_ACTIONS: Record<string, { label: string; next: string }> = {
  assigned: { label: 'Accept Job', next: 'accepted' },
  accepted: { label: 'On My Way', next: 'on_the_way' },
  on_the_way: { label: "I've Arrived", next: 'arrived' },
}

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job, isLoading, refetch } = useJob(jobId)
  const router = useRouter()
  const addAction = useQueueStore((s) => s.addAction)

  if (isLoading || !job) {
    return <YStack flex={1} justifyContent="center" alignItems="center"><Spinner /></YStack>
  }

  const status = job.status as DeliveryStatus
  const action = STATUS_ACTIONS[status]

  const handleStatusUpdate = async (nextStatus: string) => {
    const actionId = generateActionId()
    addAction({
      actionId,
      endpoint: `/jobs/${jobId}/status`,
      method: 'POST',
      body: { action_id: actionId, status: nextStatus, timestamp: new Date().toISOString() },
    })
    try {
      await updateStatus(jobId, {
        action_id: actionId,
        status: nextStatus,
        timestamp: new Date().toISOString(),
      })
    } catch {}
    refetch()
  }

  const handleCall = () => {
    if (job.phone) Linking.openURL(`tel:${job.phone}`)
  }

  const handleNavigate = () => {
    if (job.address) {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(job.address)}`
      Linking.openURL(url)
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: job.odoo_reference }} />
      <ScrollView>
        <YStack padding="$4" gap="$3">
          {/* Header */}
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack flex={1}>
              <Text fontSize={22} fontWeight="800">{job.customer_name}</Text>
              <Text fontSize={13} color="$colorSubtle" marginTop="$1">
                {job.odoo_reference} · {job.warehouse}
              </Text>
            </YStack>
            <StatusBadge status={status} />
          </XStack>

          {/* Quick action row */}
          <XStack gap="$2">
            <Button flex={1} size="$4" borderRadius={12} backgroundColor="#f0fdf4" onPress={handleCall}>
              <YStack alignItems="center">
                <Text fontSize={20}>📞</Text>
                <Text fontSize={10} color="#16a34a" fontWeight="600">Call</Text>
              </YStack>
            </Button>
            <Button flex={1} size="$4" borderRadius={12} backgroundColor="#eff6ff" onPress={handleNavigate}>
              <YStack alignItems="center">
                <Text fontSize={20}>📍</Text>
                <Text fontSize={10} color="#2563eb" fontWeight="600">Navigate</Text>
              </YStack>
            </Button>
            <Button flex={1} size="$4" borderRadius={12} backgroundColor={job.collection_required ? '#fef2f2' : '#f3f4f6'}>
              <YStack alignItems="center">
                <Text fontSize={20}>💰</Text>
                <Text fontSize={10} color={job.collection_required ? '#dc2626' : '#6b7280'} fontWeight="600">
                  {job.collection_required ? `$${job.expected_collection_amount?.toLocaleString()}` : 'None'}
                </Text>
              </YStack>
            </Button>
          </XStack>

          {/* Info */}
          <Card padded bordered borderRadius={14}>
            <YStack gap="$3">
              {job.address && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Address</Text>
                  <Text fontSize={14} fontWeight="500">{job.address}</Text>
                </YStack>
              )}
              {job.delivery_notes && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Notes</Text>
                  <Text fontSize={14}>{stripHtml(job.delivery_notes)}</Text>
                </YStack>
              )}
              {job.account_no && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Account</Text>
                  <Text fontSize={14}>{job.account_no}</Text>
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Items */}
          {job.items.length > 0 && (
            <Card padded bordered borderRadius={14}>
              <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Items ({job.items.length})
              </Text>
              <YStack marginTop="$2" gap="$1">
                {job.items.map((item, i) => (
                  <Text key={i} fontSize={13}>
                    {item.product_name} × {item.quantity}
                  </Text>
                ))}
              </YStack>
            </Card>
          )}
        </YStack>
      </ScrollView>

      {/* Action buttons */}
      <YStack padding="$4" gap="$2" backgroundColor="$backgroundStrong" borderTopWidth={1} borderTopColor="$borderColor">
        {action && (
          <ActionButton label={action.label} onPress={() => handleStatusUpdate(action.next)} />
        )}
        {status === 'arrived' && (
          <>
            <ActionButton
              label="Complete Delivery"
              onPress={() => router.push(`/jobs/${jobId}/complete`)}
            />
            <ActionButton label="Report Problem" variant="outline" onPress={() => {
              // TODO: implement failure reason bottom sheet in a follow-up
              Alert.alert('Report Problem', 'Coming soon')
            }} />
          </>
        )}
      </YStack>
    </YStack>
  )
}
