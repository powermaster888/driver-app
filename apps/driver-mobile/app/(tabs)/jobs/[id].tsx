import React, { useState } from 'react'
import { ScrollView, Linking, Modal, TextInput, Pressable, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner, Button } from 'tamagui'
import { Phone, MapPin, Banknote, MessageCircle, AlertTriangle } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { ActionButton } from '../../../src/components/ActionButton'
import { CashBadge } from '../../../src/components/CashBadge'
import { WhatsAppSheet } from '../../../src/components/WhatsAppSheet'
import { updateStatus } from '../../../src/api/status'
import { useQueueStore } from '../../../src/store/queue'
import { useSettingsStore } from '../../../src/store/settings'
import { generateActionId } from '../../../src/utils/uuid'
import { stripHtml } from '../../../src/utils/html'
import { showToast, triggerHaptic } from '../../../src/utils/feedback'
import { STATUS_COLORS, type DeliveryStatus } from '../../../src/theme/status-colors'

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const steps = ['accepted', 'on_the_way', 'arrived', 'delivered']
  const stepLabels = ['Accepted', 'On Way', 'Arrived', 'Delivered']
  const currentIndex = steps.indexOf(currentStatus)

  return (
    <XStack alignItems="center" justifyContent="center" paddingVertical="$3" gap={0}>
      {steps.map((step, i) => {
        const isCompleted = i <= currentIndex
        const isCurrent = step === currentStatus
        const color = isCompleted ? STATUS_COLORS[step as DeliveryStatus]?.border || '#22c55e' : '#e5e7eb'

        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <YStack height={2} flex={1} backgroundColor={isCompleted ? color : '#e5e7eb'} />
            )}
            <YStack alignItems="center" gap={4}>
              <YStack
                width={isCurrent ? 16 : 10}
                height={isCurrent ? 16 : 10}
                borderRadius={isCurrent ? 8 : 5}
                backgroundColor={isCompleted ? color : '#e5e7eb'}
                borderWidth={isCurrent ? 3 : 0}
                borderColor={isCurrent ? 'white' : undefined}
                {...(isCurrent && { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6 })}
              />
              <Text fontSize={9} color={isCompleted ? color : '$colorSubtle'} fontWeight={isCurrent ? '700' : '400'}>
                {stepLabels[i]}
              </Text>
            </YStack>
          </React.Fragment>
        )
      })}
    </XStack>
  )
}

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }> = {
  assigned: { label: 'Accept Job', next: 'accepted', color: '#F97316' },
  accepted: { label: 'On My Way', next: 'on_the_way', color: '#2563EB' },
  on_the_way: { label: "I've Arrived", next: 'arrived', color: '#7c3aed' },
}

const FAILURE_LABELS: Record<string, string> = {
  customer_not_home: 'Customer Not Home',
  wrong_address: 'Wrong Address',
  customer_refused: 'Customer Refused',
  access_issue: 'Access Issue',
  other: 'Other',
}

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job, isLoading, refetch } = useJob(jobId)
  const router = useRouter()
  const queryClient = useQueryClient()
  const addAction = useQueueStore((s) => s.addAction)
  const theme = useSettingsStore((s) => s.theme)

  const [showAllItems, setShowAllItems] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [showFailure, setShowFailure] = useState(false)
  const [failureReason, setFailureReason] = useState('')
  const [failureNote, setFailureNote] = useState('')

  if (isLoading || !job) {
    return <YStack flex={1} justifyContent="center" alignItems="center"><Spinner /></YStack>
  }

  const status = job.status as DeliveryStatus
  const action = STATUS_ACTIONS[status]

  const handleStatusUpdate = async (nextStatus: string) => {
    const actionId = generateActionId()
    const previousStatus = job!.status

    // Optimistic update — immediately update UI
    queryClient.setQueryData(['jobs', jobId], (old: any) =>
      old ? { ...old, status: nextStatus } : old
    )
    // Also update in the jobs list cache
    queryClient.setQueryData(['jobs', 'pending'], (old: any) =>
      old ? { ...old, jobs: old.jobs.map((j: any) => j.job_id === jobId ? { ...j, status: nextStatus } : j) } : old
    )

    await triggerHaptic('success')

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
      showToast(`Status updated to ${nextStatus.replace('_', ' ')}`, 'success')
    } catch (e: any) {
      // Rollback on failure
      queryClient.setQueryData(['jobs', jobId], (old: any) =>
        old ? { ...old, status: previousStatus } : old
      )
      queryClient.setQueryData(['jobs', 'pending'], (old: any) =>
        old ? { ...old, jobs: old.jobs.map((j: any) => j.job_id === jobId ? { ...j, status: previousStatus } : j) } : old
      )
      showToast(e?.message || 'Action queued for sync', 'info')
    }
    refetch()
  }

  const handleCall = () => {
    if (job.phone) Linking.openURL(`tel:${job.phone}`)
  }

  const handleNavigate = () => {
    if (job.address) {
      const encoded = encodeURIComponent(job.address)
      const url = Platform.OS === 'android'
        ? `geo:0,0?q=${encoded}`
        : `maps:0,0?q=${encoded}`
      Linking.openURL(url)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
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

          {/* Status timeline */}
          {!['assigned', 'failed', 'returned'].includes(status) && (
            <Card borderWidth={1} borderColor="$borderColor" borderRadius={14} padding="$3">
              <StatusTimeline currentStatus={status} />
            </Card>
          )}

          {/* Quick action row */}
          <XStack gap="$2">
            <Pressable
              style={{ flex: 1, opacity: job.phone ? 1 : 0.4 }}
              onPress={handleCall}
              disabled={!job.phone}
              accessibilityLabel="Call"
              accessibilityRole="button"
            >
              <Card borderRadius={12} padding="$3" alignItems="center" gap="$2" bordered>
                <YStack width={40} height={40} borderRadius={12} backgroundColor={theme === 'dark' ? 'rgba(22,163,74,0.15)' : '#dcfce7'} alignItems="center" justifyContent="center">
                  <Phone size={20} color="#16a34a" />
                </YStack>
                <Text fontSize={11} fontWeight="600" color="#16a34a">Call</Text>
              </Card>
            </Pressable>
            <Pressable
              style={{ flex: 1, opacity: job.phone ? 1 : 0.4 }}
              onPress={() => setShowWhatsApp(true)}
              disabled={!job.phone}
              accessibilityLabel="WhatsApp"
              accessibilityRole="button"
            >
              <Card borderRadius={12} padding="$3" alignItems="center" gap="$2" bordered>
                <YStack width={40} height={40} borderRadius={12} backgroundColor="rgba(37,211,102,0.15)" alignItems="center" justifyContent="center">
                  <MessageCircle size={20} color="#25D366" />
                </YStack>
                <Text fontSize={11} fontWeight="600" color="#25D366">WhatsApp</Text>
              </Card>
            </Pressable>
            <Pressable
              style={{ flex: 1, opacity: job.address ? 1 : 0.4 }}
              onPress={handleNavigate}
              disabled={!job.address}
              accessibilityLabel="Navigate"
              accessibilityRole="button"
            >
              <Card borderRadius={12} padding="$3" alignItems="center" gap="$2" bordered>
                <YStack width={40} height={40} borderRadius={12} backgroundColor={theme === 'dark' ? 'rgba(37,99,235,0.15)' : '#dbeafe'} alignItems="center" justifyContent="center">
                  <MapPin size={20} color="#2563eb" />
                </YStack>
                <Text fontSize={11} fontWeight="600" color="#2563eb">Navigate</Text>
              </Card>
            </Pressable>
            <Pressable
              style={{ flex: 1 }}
              accessibilityLabel="Cash"
              accessibilityRole="button"
            >
              <Card borderRadius={12} padding="$3" alignItems="center" gap="$2" bordered>
                <YStack width={40} height={40} borderRadius={12} backgroundColor={job.collection_required ? (theme === 'dark' ? 'rgba(239,68,68,0.15)' : '#fee2e2') : (theme === 'dark' ? 'rgba(107,114,128,0.15)' : '#e5e7eb')} alignItems="center" justifyContent="center">
                  <Banknote size={20} color={job.collection_required ? '#dc2626' : '#6b7280'} />
                </YStack>
                <Text fontSize={11} fontWeight="600" color={job.collection_required ? '#dc2626' : '#6b7280'}>
                  {job.collection_required ? `$${job.expected_collection_amount?.toLocaleString()}` : 'None'}
                </Text>
              </Card>
            </Pressable>
          </XStack>

          {/* Info */}
          <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={14}>
            <YStack gap="$3">
              {job.address && (
                <Pressable onPress={handleNavigate} accessibilityLabel="Open address in maps" accessibilityRole="link">
                  <YStack>
                    <Text fontSize={11} color="$colorSubtle">Address</Text>
                    <Text fontSize={14} fontWeight="500" color="#2563eb" textDecorationLine="underline">{job.address}</Text>
                  </YStack>
                </Pressable>
              )}
              {job.account_no && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Account</Text>
                  <Text fontSize={14}>{job.account_no}</Text>
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Delivery notes */}
          {job.delivery_notes && (
            <Card borderRadius={14} padding="$3" backgroundColor={theme === 'dark' ? 'rgba(245,158,11,0.1)' : '#fefce8'} borderWidth={1} borderColor={theme === 'dark' ? 'rgba(245,158,11,0.2)' : '#fef3c7'}>
              <XStack gap="$2" alignItems="flex-start">
                <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                <YStack flex={1}>
                  <Text fontSize={11} color={theme === 'dark' ? '#f59e0b' : '#92400e'} fontWeight="600">Delivery Notes</Text>
                  <Text fontSize={13} color={theme === 'dark' ? '#fbbf24' : '#78350f'} marginTop="$1">{stripHtml(job.delivery_notes)}</Text>
                </YStack>
              </XStack>
            </Card>
          )}

          {/* Items */}
          {job.items.length > 0 && (
            <Card padded bordered borderRadius={14}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  Items ({job.items.length})
                </Text>
                {job.items.length > 3 && !showAllItems && (
                  <Pressable onPress={() => setShowAllItems(true)}>
                    <Text fontSize={11} color="$primary" fontWeight="600">Show all</Text>
                  </Pressable>
                )}
              </XStack>
              <YStack marginTop="$2" gap="$1">
                {(showAllItems ? job.items : job.items.slice(0, 3)).map((item, i) => (
                  <XStack key={i} justifyContent="space-between" alignItems="center" paddingVertical="$1">
                    <Text fontSize={13} flex={1} numberOfLines={1}>{item.product_name}</Text>
                    <Text fontSize={13} fontWeight="600" marginLeft="$2">{'\u00d7'}{item.quantity}</Text>
                  </XStack>
                ))}
              </YStack>
            </Card>
          )}
        </YStack>
      </ScrollView>

      {/* Action buttons */}
      <YStack padding="$4" gap="$2" backgroundColor="$backgroundStrong" borderTopWidth={1} borderTopColor="$borderColor">
        {action && (
          <ActionButton label={action.label} color={action.color} onPress={() => handleStatusUpdate(action.next)} />
        )}
        {status === 'arrived' && (
          <ActionButton
            label="Complete Delivery"
            color="#F97316"
            onPress={() => router.push(`/jobs/${jobId}/complete`)}
          />
        )}
        {(status === 'on_the_way' || status === 'arrived') && (
          <ActionButton label="Report Problem" variant="outline" onPress={() => setShowFailure(true)} />
        )}
      </YStack>

      {/* Failure reason modal */}
      <Modal visible={showFailure} animationType="slide" transparent>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setShowFailure(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme === 'dark' ? '#1c1c1e' : '#ffffff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 24,
              paddingBottom: 40,
            }}
            onPress={() => {}}
          >
            <Text fontSize={18} fontWeight="700" marginBottom={16}>Report Problem</Text>

            <YStack gap="$2">
              {Object.entries(FAILURE_LABELS).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setFailureReason(key)}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: failureReason === key ? '#2563eb' : (theme === 'dark' ? '#333' : '#e5e7eb'),
                    backgroundColor: failureReason === key
                      ? (theme === 'dark' ? 'rgba(37,99,235,0.15)' : '#eff6ff')
                      : 'transparent',
                  }}
                >
                  <Text fontSize={15} fontWeight="600">{label}</Text>
                </Pressable>
              ))}
            </YStack>

            <TextInput
              placeholder="Optional note..."
              placeholderTextColor={theme === 'dark' ? '#888' : '#999'}
              value={failureNote}
              onChangeText={setFailureNote}
              multiline
              style={{
                marginTop: 16,
                borderWidth: 1,
                borderColor: theme === 'dark' ? '#333' : '#e5e7eb',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                minHeight: 60,
                color: theme === 'dark' ? '#fff' : '#000',
              }}
            />

            <XStack gap="$2" marginTop={20}>
              <Button
                flex={1} size="$4" chromeless
                onPress={() => {
                  setShowFailure(false)
                  setFailureReason('')
                  setFailureNote('')
                }}
              >
                <Text color="$colorSubtle">Cancel</Text>
              </Button>
              <Button
                flex={1} size="$5" backgroundColor="$primary" borderRadius={14}
                disabled={!failureReason}
                opacity={failureReason ? 1 : 0.5}
                onPress={async () => {
                  const actionId = generateActionId()
                  const previousStatus = job!.status

                  // Optimistic update
                  queryClient.setQueryData(['jobs', jobId], (old: any) =>
                    old ? { ...old, status: 'failed' } : old
                  )
                  queryClient.setQueryData(['jobs', 'pending'], (old: any) =>
                    old ? { ...old, jobs: old.jobs.map((j: any) => j.job_id === jobId ? { ...j, status: 'failed' } : j) } : old
                  )

                  addAction({
                    actionId,
                    endpoint: `/jobs/${jobId}/status`,
                    method: 'POST',
                    body: {
                      action_id: actionId,
                      status: 'failed',
                      reason: failureReason,
                      note: failureNote || undefined,
                      timestamp: new Date().toISOString(),
                    },
                  })
                  try {
                    await updateStatus(jobId, {
                      action_id: actionId,
                      status: 'failed',
                      reason: failureReason,
                      note: failureNote || undefined,
                      timestamp: new Date().toISOString(),
                    })
                    await triggerHaptic('warning')
                    showToast('Problem reported', 'success')
                  } catch {
                    // Rollback
                    queryClient.setQueryData(['jobs', jobId], (old: any) =>
                      old ? { ...old, status: previousStatus } : old
                    )
                    queryClient.setQueryData(['jobs', 'pending'], (old: any) =>
                      old ? { ...old, jobs: old.jobs.map((j: any) => j.job_id === jobId ? { ...j, status: previousStatus } : j) } : old
                    )
                    showToast('Report queued for sync', 'info')
                  }
                  setShowFailure(false)
                  setFailureReason('')
                  setFailureNote('')
                  refetch()
                }}
              >
                <Text color="white" fontWeight="700">Submit</Text>
              </Button>
            </XStack>
          </Pressable>
        </Pressable>
      </Modal>

      {job.phone && (
        <WhatsAppSheet
          visible={showWhatsApp}
          onClose={() => setShowWhatsApp(false)}
          phone={job.phone}
          customerName={job.customer_name}
          odooReference={job.odoo_reference}
          status={status}
        />
      )}
    </YStack>
    </SafeAreaView>
  )
}
