import { useState } from 'react'
import { ScrollView, Linking, Modal, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner, Button } from 'tamagui'
import { Phone, MapPin, Banknote, MessageCircle } from 'lucide-react-native'
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
import type { DeliveryStatus } from '../../../src/theme/status-colors'

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
  const addAction = useQueueStore((s) => s.addAction)
  const theme = useSettingsStore((s) => s.theme)

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
      await triggerHaptic('success')
      showToast(`Status updated to ${nextStatus.replace('_', ' ')}`, 'success')
    } catch (e: any) {
      showToast(e?.message || 'Action queued for sync', 'info')
    }
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

          {/* Quick action row */}
          <XStack gap="$2">
            <Button
              flex={1}
              size="$4"
              borderRadius={12}
              backgroundColor={theme === 'dark' ? 'rgba(22,163,74,0.1)' : '#f0fdf4'}
              onPress={handleCall}
              disabled={!job.phone}
              opacity={job.phone ? 1 : 0.4}
              pressStyle={{ opacity: 0.7 }}
              accessibilityLabel="Call customer"
              accessibilityRole="button"
            >
              <YStack alignItems="center" gap={4}>
                <YStack width={40} height={40} borderRadius={20} backgroundColor={theme === 'dark' ? 'rgba(22,163,74,0.15)' : '#dcfce7'} justifyContent="center" alignItems="center">
                  <Phone size={20} color="#16a34a" />
                </YStack>
                <Text fontSize={10} color="#16a34a" fontWeight="600">Call</Text>
              </YStack>
            </Button>
            <Button
              flex={1}
              size="$4"
              borderRadius={12}
              backgroundColor={theme === 'dark' ? 'rgba(37,211,102,0.1)' : '#f0fdf4'}
              onPress={() => setShowWhatsApp(true)}
              disabled={!job.phone}
              opacity={job.phone ? 1 : 0.4}
              pressStyle={{ opacity: 0.7 }}
              accessibilityLabel="WhatsApp customer"
              accessibilityRole="button"
            >
              <YStack alignItems="center" gap={4}>
                <YStack width={40} height={40} borderRadius={20} backgroundColor={theme === 'dark' ? 'rgba(37,211,102,0.15)' : '#dcfce7'} justifyContent="center" alignItems="center">
                  <MessageCircle size={20} color="#25D366" />
                </YStack>
                <Text fontSize={10} color="#25D366" fontWeight="600">WhatsApp</Text>
              </YStack>
            </Button>
            <Button
              flex={1}
              size="$4"
              borderRadius={12}
              backgroundColor={theme === 'dark' ? 'rgba(37,99,235,0.1)' : '#eff6ff'}
              onPress={handleNavigate}
              disabled={!job.address}
              opacity={job.address ? 1 : 0.4}
              pressStyle={{ opacity: 0.7 }}
              accessibilityLabel="Navigate to address"
              accessibilityRole="button"
            >
              <YStack alignItems="center" gap={4}>
                <YStack width={40} height={40} borderRadius={20} backgroundColor={theme === 'dark' ? 'rgba(37,99,235,0.15)' : '#dbeafe'} justifyContent="center" alignItems="center">
                  <MapPin size={20} color="#2563eb" />
                </YStack>
                <Text fontSize={10} color="#2563eb" fontWeight="600">Navigate</Text>
              </YStack>
            </Button>
            <Button
              flex={1}
              size="$4"
              borderRadius={12}
              backgroundColor={job.collection_required ? (theme === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2') : (theme === 'dark' ? 'rgba(107,114,128,0.1)' : '#f3f4f6')}
              pressStyle={{ opacity: 0.7 }}
            >
              <YStack alignItems="center" gap={4}>
                <YStack width={40} height={40} borderRadius={20} backgroundColor={job.collection_required ? (theme === 'dark' ? 'rgba(239,68,68,0.15)' : '#fee2e2') : (theme === 'dark' ? 'rgba(107,114,128,0.15)' : '#e5e7eb')} justifyContent="center" alignItems="center">
                  <Banknote size={20} color={job.collection_required ? '#dc2626' : '#6b7280'} />
                </YStack>
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
                    {item.product_name} x {item.quantity}
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
                flex={1} size="$5" backgroundColor="$primary" color="white" fontWeight="700" borderRadius={14}
                disabled={!failureReason}
                opacity={failureReason ? 1 : 0.5}
                onPress={async () => {
                  const actionId = generateActionId()
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
                    showToast('Report queued for sync', 'info')
                  }
                  setShowFailure(false)
                  setFailureReason('')
                  setFailureNote('')
                  refetch()
                }}
              >
                Submit
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
