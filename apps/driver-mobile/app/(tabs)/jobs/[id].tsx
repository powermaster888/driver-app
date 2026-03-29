import React, { useState } from 'react'
import { ScrollView, Linking, Modal, TextInput, Pressable, Platform, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner, Button } from 'tamagui'
import { LinearGradient } from 'expo-linear-gradient'
import { Phone, MapPin, Banknote, MessageCircle, AlertTriangle, ArrowLeft, StickyNote, ChevronDown, ScanLine, Check } from 'lucide-react-native'
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

const STATUS_HEADER_COLORS: Record<string, string> = {
  assigned: '#F97316',
  accepted: '#22c55e',
  on_the_way: '#2563eb',
  arrived: '#7c3aed',
  delivered: '#16a34a',
  failed: '#dc2626',
  returned: '#6b7280',
}

const STATUS_HEADER_GRADIENTS: Record<string, [string, string]> = {
  assigned: ['#F97316', '#ea580c'],
  accepted: ['#22c55e', '#16a34a'],
  on_the_way: ['#2563eb', '#1d4ed8'],
  arrived: ['#7c3aed', '#6d28d9'],
  delivered: ['#16a34a', '#15803d'],
  failed: ['#dc2626', '#b91c1c'],
  returned: ['#6b7280', '#4b5563'],
}

function StatusTimeline({ currentStatus, theme }: { currentStatus: string; theme?: 'dark' | 'light' }) {
  const steps = ['accepted', 'on_the_way', 'arrived', 'delivered']
  const stepLabels = ['Accepted', 'On Way', 'Arrived', 'Delivered']
  const currentIndex = steps.indexOf(currentStatus)
  const isDark = theme === 'dark'

  const activeColor = isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8'
  const inactiveColor = isDark ? 'rgba(255,255,255,0.2)' : '#e2e8f0'

  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 4 }}>
      {/* Single row: each step is a column with dot on top and label below, lines connect between */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {steps.map((step, i) => {
          const isCompleted = i <= currentIndex
          const isCurrent = step === currentStatus
          const dotColor = isCompleted ? activeColor : inactiveColor
          const labelColor = isDark
            ? (isCurrent ? 'white' : isCompleted ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)')
            : (isCurrent ? '#0f172a' : isCompleted ? '#64748b' : '#cbd5e1')

          return (
            <React.Fragment key={step}>
              {/* Connecting line before this dot (not for first) */}
              {i > 0 && (
                <View style={{ flex: 1, justifyContent: 'center', height: 20 }}>
                  <View style={{ height: 2, backgroundColor: isCompleted ? activeColor : inactiveColor }} />
                </View>
              )}
              {/* Dot + label column */}
              <View style={{ alignItems: 'center', minWidth: 50 }}>
                <View style={{
                  width: isCurrent ? 18 : 10,
                  height: isCurrent ? 18 : 10,
                  borderRadius: isCurrent ? 9 : 5,
                  backgroundColor: isCurrent ? 'white' : dotColor,
                  borderWidth: isCurrent ? 3 : 0,
                  borderColor: isCurrent ? (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.1)') : 'transparent',
                  marginTop: isCurrent ? 1 : 5,
                  ...(isCurrent && isDark ? { shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8 } : {}),
                }} />
                <Text
                  fontSize={10}
                  fontWeight={isCurrent ? '700' : '400'}
                  color={labelColor}
                  textAlign="center"
                  marginTop={6}
                >
                  {stepLabels[i]}
                </Text>
              </View>
            </React.Fragment>
          )
        })}
      </View>
    </View>
  )
}

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }> = {
  assigned: { label: 'Accept Job', next: 'accepted', color: '#F97316' },
  accepted: { label: 'On My Way', next: 'on_the_way', color: '#2563EB' },
  on_the_way: { label: "I've Arrived", next: 'arrived', color: '#7c3aed' },
  failed: { label: 'Mark Returned', next: 'returned', color: '#6b7280' },
}

const FAILURE_LABELS: Record<string, string> = {
  customer_not_home: 'Customer Not Home',
  wrong_address: 'Wrong Address',
  customer_refused: 'Customer Refused',
  access_issue: 'Access Issue',
  other: 'Other',
}

export default function JobDetail() {
  const { id, scannedCode } = useLocalSearchParams<{ id: string; scannedCode?: string }>()
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
  const [driverNote, setDriverNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)

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
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        {/* Gradient hero header */}
        <LinearGradient
          colors={STATUS_HEADER_GRADIENTS[status] || ['#2563eb', '#1d4ed8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
            borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
            shadowColor: STATUS_HEADER_GRADIENTS[status]?.[0] || '#2563eb',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -4 }}>
              <ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
              <Text fontSize={14} color="rgba(255,255,255,0.8)" fontWeight="500">Back</Text>
            </Pressable>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
              <Text fontSize={11} color="white" fontWeight="700">{status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </XStack>
          <Text fontSize={24} fontWeight="800" color="white">{job.customer_name}</Text>
          <Text fontSize={13} color="rgba(255,255,255,0.6)" marginTop={6}>{job.odoo_reference} · {job.warehouse}{job.account_no ? ` · ${job.account_no}` : ''}</Text>

          {/* Timeline in header */}
          {!['assigned', 'failed', 'returned'].includes(status) && (
            <StatusTimeline currentStatus={status} theme="dark" />
          )}
        </LinearGradient>

        {/* Floating contact bar */}
        <View style={{
          marginTop: -18, marginHorizontal: 16, backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
          borderRadius: 16, padding: 6, flexDirection: 'row', gap: 6,
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8,
        }}>
          <Pressable
            style={{ flex: 1, opacity: job.phone ? 1 : 0.4, alignItems: 'center', paddingVertical: 12, backgroundColor: theme === 'dark' ? 'rgba(34,197,94,0.1)' : '#f0fdf4', borderRadius: 12 }}
            onPress={handleCall}
            disabled={!job.phone}
            accessibilityLabel="Call"
            accessibilityRole="button"
          >
            <Phone size={20} color="#16a34a" />
            <Text fontSize={11} fontWeight="600" color="#16a34a" marginTop={4}>Call</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, opacity: job.phone ? 1 : 0.4, alignItems: 'center', paddingVertical: 12, backgroundColor: theme === 'dark' ? 'rgba(37,211,102,0.1)' : '#f0fdf4', borderRadius: 12 }}
            onPress={() => setShowWhatsApp(true)}
            disabled={!job.phone}
            accessibilityLabel="WhatsApp"
            accessibilityRole="button"
          >
            <MessageCircle size={20} color="#25D366" />
            <Text fontSize={11} fontWeight="600" color="#25D366" marginTop={4}>WhatsApp</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, opacity: job.address ? 1 : 0.4, alignItems: 'center', paddingVertical: 12, backgroundColor: theme === 'dark' ? 'rgba(37,99,235,0.1)' : '#eff6ff', borderRadius: 12 }}
            onPress={handleNavigate}
            disabled={!job.address}
            accessibilityLabel="Navigate"
            accessibilityRole="button"
          >
            <MapPin size={20} color="#2563eb" />
            <Text fontSize={11} fontWeight="600" color="#2563eb" marginTop={4}>Navigate</Text>
          </Pressable>
          {job.collection_required && (
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: theme === 'dark' ? 'rgba(220,38,38,0.1)' : '#fef2f2', borderRadius: 12 }}>
              <Banknote size={20} color="#dc2626" />
              <Text fontSize={11} fontWeight="600" color="#dc2626" marginTop={4}>
                ${job.expected_collection_amount?.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <YStack paddingHorizontal={16} paddingTop={16} gap={12}>
          {/* Info */}
          <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={16}>
            <YStack gap="$3">
              {job.address && (
                <Pressable onPress={handleNavigate} accessibilityLabel="Open address in maps" accessibilityRole="link">
                  <YStack>
                    <Text fontSize={11} fontWeight="500" color="$colorSubtle">Address</Text>
                    <Text fontSize={14} fontWeight="500" color="#2563eb" textDecorationLine="underline">{job.address}</Text>
                  </YStack>
                </Pressable>
              )}
              {job.account_no && (
                <YStack>
                  <Text fontSize={11} fontWeight="500" color="$colorSubtle">Account</Text>
                  <Text fontSize={14} fontWeight="500">{job.account_no}</Text>
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Delivery notes */}
          {job.delivery_notes && (
            <Card borderRadius={16} padding="$3" backgroundColor={theme === 'dark' ? 'rgba(245,158,11,0.1)' : '#fefce8'} borderWidth={1} borderColor={theme === 'dark' ? 'rgba(245,158,11,0.2)' : '#fef3c7'}>
              <XStack gap="$2" alignItems="flex-start">
                <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                <YStack flex={1}>
                  <Text fontSize={11} color={theme === 'dark' ? '#f59e0b' : '#92400e'} fontWeight="600">Delivery Notes</Text>
                  <Text fontSize={13} color={theme === 'dark' ? '#fbbf24' : '#78350f'} marginTop="$1">{stripHtml(job.delivery_notes)}</Text>
                </YStack>
              </XStack>
            </Card>
          )}

          {/* Items — merged into same card style */}
          {job.items.length > 0 && (
            <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={16}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={11} color="$colorSubtle" fontWeight="700" textTransform="uppercase" letterSpacing={0.5}>
                  Items ({job.items.length})
                </Text>
                {job.items.length > 3 && !showAllItems && (
                  <Pressable onPress={() => setShowAllItems(true)}>
                    <Text fontSize={11} color="#2563eb" fontWeight="600">Show all</Text>
                  </Pressable>
                )}
              </XStack>
              <YStack marginTop="$2" gap="$1">
                {(showAllItems ? job.items : job.items.slice(0, 3)).map((item, i) => {
                  const isMatch = scannedCode && (
                    item.product_name.toLowerCase().includes(scannedCode.toLowerCase()) ||
                    (item as any).barcode === scannedCode
                  )
                  return (
                    <XStack
                      key={i}
                      justifyContent="space-between"
                      alignItems="center"
                      paddingVertical="$1"
                      paddingHorizontal="$2"
                      marginLeft={-8}
                      marginRight={-8}
                      borderRadius={8}
                      backgroundColor={isMatch ? (theme === 'dark' ? 'rgba(34,197,94,0.15)' : '#dcfce7') : 'transparent'}
                    >
                      <XStack alignItems="center" gap={6} flex={1}>
                        {isMatch && <Check size={14} color="#16a34a" />}
                        <Text fontSize={13} fontWeight={isMatch ? '700' : '400'} flex={1} numberOfLines={1} color={isMatch ? '#16a34a' : '$color'}>
                          {item.product_name}
                        </Text>
                      </XStack>
                      <Text fontSize={13} fontWeight="600" marginLeft="$2">{'\u00d7'}{item.quantity}</Text>
                    </XStack>
                  )
                })}
              </YStack>
            </Card>
          )}

          {/* Scan match banner */}
          {scannedCode && (
            <Card padding="$3" borderRadius={12} backgroundColor={theme === 'dark' ? 'rgba(34,197,94,0.1)' : '#f0fdf4'} borderWidth={1} borderColor={theme === 'dark' ? 'rgba(34,197,94,0.2)' : '#bbf7d0'}>
              <XStack alignItems="center" gap={8}>
                <Check size={16} color="#16a34a" />
                <YStack flex={1}>
                  <Text fontSize={12} fontWeight="600" color="#16a34a">Scanned: {scannedCode}</Text>
                  <Text fontSize={11} color={theme === 'dark' ? 'rgba(34,197,94,0.7)' : '#15803d'} marginTop={2}>
                    Matching items highlighted in green
                  </Text>
                </YStack>
              </XStack>
            </Card>
          )}

          {/* Scan Items */}
          {job.items.length > 0 && (
            <Pressable
              onPress={() => router.push(`/scanner?jobId=${jobId}`)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: theme === 'dark' ? 'rgba(37,99,235,0.1)' : '#eff6ff', borderRadius: 12 }}
            >
              <ScanLine size={16} color="#2563eb" />
              <Text fontSize={13} fontWeight="600" color="#2563eb">Scan Items to Verify</Text>
            </Pressable>
          )}

          {/* Driver Notes */}
          <Pressable onPress={() => setShowNoteInput(!showNoteInput)}>
            <XStack padding="$3" backgroundColor="$backgroundStrong" borderRadius={12} borderWidth={1} borderColor="$borderColor" justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap={8}>
                <StickyNote size={16} color="#2563eb" />
                <Text fontSize={13} fontWeight="600" color="$color">Add Note</Text>
              </XStack>
              <ChevronDown size={16} color="$colorSubtle" style={{ transform: [{ rotate: showNoteInput ? '180deg' : '0deg' }] }} />
            </XStack>
          </Pressable>
          {showNoteInput && (
            <Card padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
              <TextInput
                value={driverNote}
                onChangeText={setDriverNote}
                placeholder="E.g. gate code 1234, leave at back door..."
                placeholderTextColor="#94a3b8"
                multiline
                style={{ fontSize: 14, minHeight: 60, color: theme === 'dark' ? '#f1f5f9' : '#0f172a', textAlignVertical: 'top' }}
              />
              {driverNote.length > 0 && (
                <Pressable
                  onPress={async () => {
                    const actionId = generateActionId()
                    addAction({
                      actionId,
                      endpoint: `/jobs/${jobId}/status`,
                      method: 'POST',
                      body: { action_id: actionId, status: status, note: driverNote, timestamp: new Date().toISOString() },
                    })
                    try {
                      await updateStatus(jobId, { action_id: actionId, status: status, note: driverNote, timestamp: new Date().toISOString() })
                      showToast('Note saved', 'success')
                      setDriverNote('')
                      setShowNoteInput(false)
                    } catch {
                      showToast('Note queued for sync', 'info')
                      setDriverNote('')
                      setShowNoteInput(false)
                    }
                  }}
                  style={{ marginTop: 8, backgroundColor: '#2563eb', borderRadius: 10, padding: 10, alignItems: 'center' }}
                >
                  <Text fontSize={13} fontWeight="600" color="white">Save Note</Text>
                </Pressable>
              )}
            </Card>
          )}
        </YStack>
      </ScrollView>

      {/* Action buttons */}
      <YStack paddingHorizontal={16} paddingTop={8} paddingBottom={24} gap="$2">
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
          <Pressable onPress={() => setShowFailure(true)} style={{ paddingVertical: 12 }}>
            <Text textAlign="center" fontSize={14} fontWeight="600" color="#dc2626">Report Problem</Text>
          </Pressable>
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
