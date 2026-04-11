import React, { useState, useEffect } from 'react'
import { ScrollView, Linking, Modal, TextInput, Pressable, Platform, View, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner, Button } from 'tamagui'
import { Phone, MapPin, Banknote, MessageCircle, AlertTriangle, ArrowLeft, StickyNote, ChevronDown, ScanLine, Check } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { ActionButton } from '../../../src/components/ActionButton'
import { CashBadge } from '../../../src/components/CashBadge'
import { WhatsAppSheet } from '../../../src/components/WhatsAppSheet'
import { updateStatus } from '../../../src/api/status'
import { useQueueStore } from '../../../src/store/queue'
import { generateActionId } from '../../../src/utils/uuid'
import { stripHtml } from '../../../src/utils/html'
import { showToast, triggerHaptic } from '../../../src/utils/feedback'
import { STATUS_COLORS, type DeliveryStatus } from '../../../src/theme/status-colors'

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }> = {
  assigned: { label: '接受訂單', next: 'accepted', color: '#F59E0B' },
  accepted: { label: '出發送貨', next: 'on_the_way', color: '#2563EB' },
  on_the_way: { label: '已到達', next: 'arrived', color: '#7C3AED' },
  failed: { label: '標記已退回', next: 'returned', color: '#6B7280' },
}

const FAILURE_LABELS: Record<string, string> = {
  customer_not_home: '客戶不在',
  wrong_address: '地址錯誤',
  customer_refused: '客戶拒收',
  access_issue: '無法進入',
  other: '其他',
}

export default function JobDetail() {
  const { id, scannedCode } = useLocalSearchParams<{ id: string; scannedCode?: string }>()
  const jobId = Number(id)
  const { data: job, isLoading, refetch } = useJob(jobId)
  const router = useRouter()
  const queryClient = useQueryClient()
  const addAction = useQueueStore((s) => s.addAction)

  const [showAllItems, setShowAllItems] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [showFailure, setShowFailure] = useState(false)
  const [failureReason, setFailureReason] = useState('')
  const [failureNote, setFailureNote] = useState('')
  const [driverNote, setDriverNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)

  const [statusHistory, setStatusHistory] = useState<{ from: string; to: string; timestamp: string }[]>([])

  useEffect(() => {
    if (!jobId) return
    AsyncStorage.getItem(`status_history_${jobId}`).then((data) => {
      if (data) setStatusHistory(JSON.parse(data))
    })
  }, [jobId])

  useEffect(() => {
    if (!scannedCode || !job?.items) return
    const hasMatch = job.items.some(
      (item) => item.barcode === scannedCode || item.product_name.toLowerCase().includes(scannedCode.toLowerCase())
    )
    if (hasMatch) triggerHaptic('success')
  }, [scannedCode, job?.items])

  if (isLoading || !job) {
    return <YStack flex={1} backgroundColor="#050505" justifyContent="center" alignItems="center"><Spinner color="#2563EB" /></YStack>
  }

  const status = job.status as DeliveryStatus
  const action = STATUS_ACTIONS[status]

  const confirmStatusUpdate = (nextStatus: string, label: string) => {
    Alert.alert('更新狀態', `確認標記為「${label}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '確認', onPress: () => handleStatusUpdate(nextStatus) },
    ])
  }

  const handleStatusUpdate = async (nextStatus: string) => {
    const actionId = generateActionId()
    const previousStatus = job!.status

    queryClient.setQueryData(['jobs', jobId], (old: any) =>
      old ? { ...old, status: nextStatus } : old
    )
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
      showToast('狀態已更新', 'success')
      const entry = { from: previousStatus, to: nextStatus, timestamp: new Date().toISOString() }
      const updated = [...statusHistory, entry]
      setStatusHistory(updated)
      AsyncStorage.setItem(`status_history_${jobId}`, JSON.stringify(updated))
    } catch (e: any) {
      queryClient.setQueryData(['jobs', jobId], (old: any) =>
        old ? { ...old, status: previousStatus } : old
      )
      queryClient.setQueryData(['jobs', 'pending'], (old: any) =>
        old ? { ...old, jobs: old.jobs.map((j: any) => j.job_id === jobId ? { ...j, status: previousStatus } : j) } : old
      )
      showToast(e?.message || '已儲存，稍後同步', 'info')
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="#050505">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        {/* Header */}
        <YStack paddingHorizontal={20} paddingTop={16} paddingBottom={24}>
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -4 }}>
              <ArrowLeft size={16} color="#8B8D94" />
              <Text fontSize={14} color="#8B8D94" fontWeight="500">返回</Text>
            </Pressable>
            <XStack alignItems="center" gap="$2">
              <StatusBadge status={status} />
              <Text fontSize={11} color="#5C5E66">{job.odoo_reference}</Text>
            </XStack>
          </XStack>
          <Text fontSize={24} fontWeight="800" color="#EDEDEF" letterSpacing={-0.5}>{job.customer_name}</Text>
          {job.address && (
            <Pressable onPress={handleNavigate}>
              <Text fontSize={14} fontWeight="400" color="#2563EB" marginTop={6}>{job.address}</Text>
            </Pressable>
          )}
          {job.phone && (
            <Pressable onPress={handleCall}>
              <Text fontSize={14} fontWeight="400" color="#8B8D94" marginTop={4}>{job.phone}</Text>
            </Pressable>
          )}
        </YStack>

        {/* 3 pill action buttons */}
        <XStack paddingHorizontal={16} gap={8} marginBottom={16}>
          <Pressable
            style={{ flex: 1, opacity: job.phone ? 1 : 0.4, alignItems: 'center', paddingVertical: 12, backgroundColor: '#111111', borderRadius: 9999 }}
            onPress={handleCall}
            disabled={!job.phone}
            accessibilityLabel="致電"
            accessibilityRole="button"
          >
            <Phone size={18} color="#22C55E" />
            <Text fontSize={11} fontWeight="600" color="#22C55E" marginTop={4}>致電</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, opacity: job.phone ? 1 : 0.4, alignItems: 'center', paddingVertical: 12, backgroundColor: '#111111', borderRadius: 9999 }}
            onPress={() => setShowWhatsApp(true)}
            disabled={!job.phone}
            accessibilityLabel="WhatsApp"
            accessibilityRole="button"
          >
            <MessageCircle size={18} color="#25D366" />
            <Text fontSize={11} fontWeight="600" color="#25D366" marginTop={4}>WhatsApp</Text>
          </Pressable>
          <Pressable
            style={{ flex: 1, opacity: job.address ? 1 : 0.4, alignItems: 'center', paddingVertical: 12, backgroundColor: '#111111', borderRadius: 9999 }}
            onPress={handleNavigate}
            disabled={!job.address}
            accessibilityLabel="導航"
            accessibilityRole="button"
          >
            <MapPin size={18} color="#2563EB" />
            <Text fontSize={11} fontWeight="600" color="#2563EB" marginTop={4}>導航</Text>
          </Pressable>
        </XStack>

        <YStack paddingHorizontal="$4" gap="$3">
          {/* Cash collection card */}
          {job.collection_required && (
            <View style={{ backgroundColor: '#111111', borderRadius: 12, padding: 16 }}>
              <Text fontSize={12} fontWeight="600" color="#5C5E66" textTransform="uppercase" letterSpacing={0.5} marginBottom={8}>代收款項</Text>
              <XStack alignItems="baseline" gap={8}>
                <Text fontSize={28} fontWeight="800" color="#EF4444" letterSpacing={-0.5}>${job.expected_collection_amount?.toLocaleString()}</Text>
                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Text fontSize={11} fontWeight="700" color="#EF4444">{job.collection_method === 'cheque' ? '支票' : '現金'}</Text>
                </View>
              </XStack>
            </View>
          )}

          {/* Delivery notes */}
          {job.delivery_notes && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 14 }}>
              <XStack gap="$2" alignItems="flex-start">
                <AlertTriangle size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                <YStack flex={1}>
                  <Text fontSize={11} color="#F59E0B" fontWeight="600">送貨備註</Text>
                  <Text fontSize={14} color="#FBBF24" marginTop="$1">{stripHtml(job.delivery_notes)}</Text>
                </YStack>
              </XStack>
            </View>
          )}

          {/* Items */}
          {job.items.length > 0 && (
            <View style={{ backgroundColor: '#111111', borderRadius: 12, padding: 16 }}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={12} color="#5C5E66" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  物品 ({job.items.length})
                </Text>
                {job.items.length > 3 && !showAllItems && (
                  <Pressable onPress={() => setShowAllItems(true)}>
                    <Text fontSize={11} color="#2563EB" fontWeight="600">顯示全部</Text>
                  </Pressable>
                )}
              </XStack>
              <YStack marginTop="$2" gap="$1">
                {(showAllItems ? job.items : job.items.slice(0, 3)).map((item, i) => {
                  const isMatch = scannedCode && (
                    item.barcode === scannedCode ||
                    item.product_name.toLowerCase().includes(scannedCode.toLowerCase())
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
                      backgroundColor={isMatch ? 'rgba(34,197,94,0.15)' : 'transparent'}
                    >
                      <XStack alignItems="center" gap={6} flex={1}>
                        {isMatch && <Check size={14} color="#22C55E" />}
                        <Text fontSize={14} fontWeight={isMatch ? '700' : '400'} flex={1} numberOfLines={1} color={isMatch ? '#22C55E' : '#EDEDEF'}>
                          {item.product_name}
                        </Text>
                      </XStack>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text fontSize={13} fontWeight="600" color="#EDEDEF">{'\u00d7'}{item.quantity}</Text>
                      </View>
                    </XStack>
                  )
                })}
              </YStack>

              {/* Scan button */}
              <Pressable
                onPress={() => router.push(`/scanner?jobId=${jobId}`)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: 'rgba(37,99,235,0.1)', borderRadius: 9999, marginTop: 12 }}
              >
                <ScanLine size={16} color="#2563EB" />
                <Text fontSize={14} fontWeight="600" color="#2563EB">掃描條碼核對</Text>
              </Pressable>
            </View>
          )}

          {/* Scan match banner */}
          {scannedCode && (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 14 }}>
              <XStack alignItems="center" gap="$2">
                <Check size={16} color="#22C55E" />
                <YStack flex={1}>
                  <Text fontSize={12} fontWeight="600" color="#22C55E">已掃描: {scannedCode}</Text>
                  <Text fontSize={11} color="rgba(34,197,94,0.7)" marginTop={2}>匹配物品已以綠色標示</Text>
                </YStack>
              </XStack>
            </View>
          )}

          {/* Driver Notes */}
          <Pressable onPress={() => setShowNoteInput(!showNoteInput)}>
            <XStack padding="$3" backgroundColor="#111111" borderRadius={12} justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$2">
                <StickyNote size={16} color="#2563EB" />
                <Text fontSize={14} fontWeight="600" color="#EDEDEF">添加備註</Text>
              </XStack>
              <ChevronDown size={16} color="#5C5E66" style={{ transform: [{ rotate: showNoteInput ? '180deg' : '0deg' }] }} />
            </XStack>
          </Pressable>
          {showNoteInput && (
            <View style={{ backgroundColor: '#111111', borderRadius: 12, padding: 14 }}>
              <TextInput
                value={driverNote}
                onChangeText={setDriverNote}
                placeholder="例如：密碼 1234、放後門..."
                placeholderTextColor="#5C5E66"
                multiline
                style={{ fontSize: 14, minHeight: 60, color: '#EDEDEF', textAlignVertical: 'top' }}
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
                      showToast('備註已儲存', 'success')
                      setDriverNote('')
                      setShowNoteInput(false)
                    } catch {
                      showToast('備註已暫存，稍後同步', 'info')
                      setDriverNote('')
                      setShowNoteInput(false)
                    }
                  }}
                  style={{ marginTop: 8, backgroundColor: '#2563EB', borderRadius: 9999, padding: 12, alignItems: 'center' }}
                >
                  <Text fontSize={14} fontWeight="600" color="white">儲存備註</Text>
                </Pressable>
              )}
            </View>
          )}

          <YStack height={24} />
        </YStack>
      </ScrollView>

      {/* Fixed bottom CTA */}
      <YStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$6" gap="$2" backgroundColor="#050505" borderTopWidth={1} borderTopColor="rgba(255,255,255,0.08)">
        {action && (
          <ActionButton label={action.label} color={action.color} onPress={() => confirmStatusUpdate(action.next, action.label)} />
        )}
        {status === 'arrived' && (
          <ActionButton
            label="完成送貨"
            color="#2563EB"
            onPress={() => router.push(`/jobs/${jobId}/complete`)}
          />
        )}
        {(status === 'on_the_way' || status === 'arrived') && (
          <Pressable onPress={() => setShowFailure(true)} style={{ paddingVertical: 12 }}>
            <Text textAlign="center" fontSize={14} fontWeight="600" color="#EF4444">報告問題</Text>
          </Pressable>
        )}
      </YStack>

      {/* Failure reason modal */}
      <Modal visible={showFailure} animationType="slide" transparent>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setShowFailure(false)}
        >
          <Pressable
            style={{
              backgroundColor: '#111111',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 24,
              paddingBottom: 40,
            }}
            onPress={() => {}}
          >
            <Text fontSize={18} fontWeight="700" color="#EDEDEF" marginBottom="$4">報告問題</Text>

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
                    borderColor: failureReason === key ? '#2563EB' : 'rgba(255,255,255,0.08)',
                    backgroundColor: failureReason === key ? 'rgba(37,99,235,0.15)' : 'transparent',
                  }}
                >
                  <Text fontSize={15} fontWeight="600" color="#EDEDEF">{label}</Text>
                </Pressable>
              ))}
            </YStack>

            <TextInput
              placeholder="補充說明（選填）..."
              placeholderTextColor="#5C5E66"
              value={failureNote}
              onChangeText={setFailureNote}
              multiline
              style={{
                marginTop: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                minHeight: 60,
                color: '#EDEDEF',
              }}
            />

            <XStack gap="$2" marginTop="$5">
              <Button
                flex={1} size="$4" chromeless
                onPress={() => {
                  setShowFailure(false)
                  setFailureReason('')
                  setFailureNote('')
                }}
              >
                <Text color="#8B8D94">取消</Text>
              </Button>
              <Button
                flex={1} size="$5" backgroundColor="#2563EB" borderRadius={9999}
                disabled={!failureReason}
                opacity={failureReason ? 1 : 0.5}
                onPress={async () => {
                  const actionId = generateActionId()
                  const previousStatus = job!.status

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
                    showToast('問題已報告', 'success')
                  } catch {
                    queryClient.setQueryData(['jobs', jobId], (old: any) =>
                      old ? { ...old, status: previousStatus } : old
                    )
                    queryClient.setQueryData(['jobs', 'pending'], (old: any) =>
                      old ? { ...old, jobs: old.jobs.map((j: any) => j.job_id === jobId ? { ...j, status: previousStatus } : j) } : old
                    )
                    showToast('報告已暫存，稍後同步', 'info')
                  }
                  setShowFailure(false)
                  setFailureReason('')
                  setFailureNote('')
                  refetch()
                }}
              >
                <Text color="white" fontWeight="700">提交</Text>
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
