import React, { useState, useRef, useEffect } from 'react'
import { ScrollView, Alert, StyleSheet, Pressable, Image, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Input, Spinner, useTheme } from 'tamagui'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Camera, PenTool, Banknote, AlertTriangle, Check } from 'lucide-react-native'
import SignatureScreen from 'react-native-signature-canvas'
import { useJob } from '../../../src/api/jobs'
import { PhotoThumbnail } from '../../../src/components/PhotoThumbnail'
import { useQueueStore } from '../../../src/store/queue'
import { generateActionId } from '../../../src/utils/uuid'
import { showToast, triggerHaptic } from '../../../src/utils/feedback'
import { uploadFile, uploadPhotoBatch } from '../../../src/api/uploads'
import { submitPod } from '../../../src/api/pod'
import { submitCash } from '../../../src/api/cash'
import { updateStatus } from '../../../src/api/status'
import { submitPartialDelivery } from '../../../src/api/partial'

type Step = 'photos' | 'signature' | 'cash' | 'confirm'

const STEP_LABELS: Record<Step, string> = {
  photos: '拍照',
  signature: '簽名',
  cash: '收款',
  confirm: '確認',
}

export default function CompleteDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job } = useJob(jobId)
  const router = useRouter()
  const addAction = useQueueStore((s) => s.addAction)
  const theme = useTheme()

  const [step, setStep] = useState<Step>('photos')
  const [photos, setPhotos] = useState<string[]>([])
  const [signatureUri, setSignatureUri] = useState<string | null>(null)
  const [cashAmount, setCashAmount] = useState(String(job?.expected_collection_amount || ''))
  const [cashMethod, setCashMethod] = useState(job?.collection_method || 'cash')
  const [cashRef, setCashRef] = useState('')
  const [cashPhotoUri, setCashPhotoUri] = useState<string | null>(null)
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [permission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const signatureRef = useRef<any>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)

  const storageKey = `completion_${jobId}`
  const [completionId] = useState(() => generateActionId())

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((data) => {
      if (data) {
        const saved = JSON.parse(data)
        if (saved.photos?.length) setPhotos(saved.photos)
        if (saved.signatureUri) setSignatureUri(saved.signatureUri)
        if (saved.cashAmount !== undefined) setCashAmount(saved.cashAmount)
        if (saved.cashMethod) setCashMethod(saved.cashMethod)
        if (saved.cashRef) setCashRef(saved.cashRef)
        if (saved.itemQuantities) setItemQuantities(saved.itemQuantities)
      }
    })
  }, [storageKey])

  useEffect(() => {
    AsyncStorage.setItem(storageKey, JSON.stringify({
      photos, signatureUri, cashAmount, cashMethod, cashRef, itemQuantities,
    }))
  }, [photos, signatureUri, cashAmount, cashMethod, cashRef, itemQuantities, storageKey])

  React.useEffect(() => {
    if (job?.items) {
      const initial: Record<number, number> = {}
      job.items.forEach((item) => {
        if (item.move_id) initial[item.move_id] = item.quantity
      })
      setItemQuantities((prev) => Object.keys(prev).length > 0 ? prev : initial)
    }
  }, [job])

  const takePhoto = async () => {
    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
    if (result?.uri) setPreviewUri(result.uri)
  }

  const acceptPhoto = () => {
    if (previewUri) {
      setPhotos((prev) => [...prev, previewUri])
      setPreviewUri(null)
    }
  }

  const retakePhoto = () => {
    setPreviewUri(null)
  }

  const steps: Step[] = ['photos', 'signature', ...(job?.collection_required ? ['cash' as Step] : []), 'confirm']
  const stepIndex = steps.indexOf(step)
  const nextStep = () => setStep(steps[stepIndex + 1])
  const prevStep = () => stepIndex > 0 && setStep(steps[stepIndex - 1])

  const canProceed = (): boolean => {
    if (step === 'photos') return photos.length > 0
    if (step === 'signature') return true
    if (step === 'cash') return !!(cashAmount && cashAmount !== '0' && !isNaN(parseFloat(cashAmount)))
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const timestamp = new Date().toISOString()

    const isPartial = job?.items?.some((item) =>
      item.move_id && (itemQuantities[item.move_id] ?? item.quantity) < item.quantity
    )

    const podActionId = generateActionId()
    const cashActionId = job?.collection_required ? generateActionId() : undefined
    const statusActionId = generateActionId()
    const partialActionId = isPartial ? generateActionId() : undefined

    addAction({
      actionId: podActionId,
      endpoint: `/jobs/${jobId}/proof-of-delivery`,
      method: 'POST',
      body: {
        action_id: podActionId,
        photo_uris: photos,
        signature_uri: signatureUri || undefined,
        timestamp,
        completion_id: completionId,
      },
    })

    if (job?.collection_required && cashActionId) {
      addAction({
        actionId: cashActionId,
        endpoint: `/jobs/${jobId}/cash-collection`,
        method: 'POST',
        body: {
          action_id: cashActionId,
          amount: parseFloat(cashAmount),
          method: cashMethod,
          reference: cashRef,
          timestamp,
          completion_id: completionId,
        },
      })
    }

    addAction({
      actionId: statusActionId,
      endpoint: `/jobs/${jobId}/status`,
      method: 'POST',
      body: {
        action_id: statusActionId,
        status: 'delivered',
        timestamp,
        completion_id: completionId,
      },
    })

    const removeAction = useQueueStore.getState().removeAction

    try {
      const uploadIds = await uploadPhotoBatch(photos, 3)

      let sigUploadId: string | undefined
      if (signatureUri) {
        try {
          const result = await uploadFile(signatureUri, 'signature')
          sigUploadId = result.upload_id
        } catch {}
      }

      await submitPod(jobId, {
        action_id: podActionId,
        photo_upload_ids: uploadIds,
        signature_upload_id: sigUploadId,
        timestamp,
        completion_id: completionId,
      })
      removeAction(podActionId)

      if (job?.collection_required && cashActionId) {
        let cashPhotoUploadId: string | undefined
        if (cashPhotoUri) {
          try {
            const result = await uploadFile(cashPhotoUri, 'photo')
            cashPhotoUploadId = result.upload_id
          } catch {}
        }

        await submitCash(jobId, {
          action_id: cashActionId,
          amount: parseFloat(cashAmount),
          method: cashMethod,
          reference: cashRef,
          photo_upload_id: cashPhotoUploadId,
          timestamp,
          completion_id: completionId,
        })
        removeAction(cashActionId)
      }

      if (isPartial && partialActionId && job?.items) {
        const items = job.items
          .filter((item) => item.move_id)
          .map((item) => ({
            move_id: item.move_id!,
            delivered_qty: itemQuantities[item.move_id!] ?? item.quantity,
          }))
        await submitPartialDelivery(jobId, {
          action_id: partialActionId,
          items,
          timestamp,
        })
      }

      await updateStatus(jobId, {
        action_id: statusActionId,
        status: 'delivered',
        timestamp,
        completion_id: completionId,
      })
      removeAction(statusActionId)

      await AsyncStorage.removeItem(storageKey)
      await triggerHaptic('success')
      showToast('送貨完成！', 'success')
      router.dismiss()
    } catch (e) {
      await AsyncStorage.removeItem(storageKey)
      showToast('已儲存，連線後自動同步', 'info')
      router.dismiss()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background?.val }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: '完成送貨', presentation: 'modal', headerShown: false }} />

      {/* Step indicator — dots with labels */}
      <XStack paddingHorizontal={24} paddingTop={20} paddingBottom={12} justifyContent="center" alignItems="flex-start" gap={0}>
        {steps.map((s, i) => {
          const isActive = i === stepIndex
          const isCompleted = i < stepIndex
          return (
            <React.Fragment key={s}>
              {i > 0 && (
                <View style={{
                  flex: 1, height: 2, marginTop: 14,
                  backgroundColor: isCompleted ? '#22C55E' : theme.borderColor?.val,
                }} />
              )}
              <YStack alignItems="center" gap={6} width={48}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: isCompleted ? '#22C55E' : isActive ? theme.primary?.val : 'transparent',
                  borderWidth: isCompleted || isActive ? 0 : 2,
                  borderColor: theme.muted?.val,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {isCompleted ? (
                    <Check size={14} color="white" />
                  ) : (
                    <View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: isActive ? 'white' : 'transparent',
                    }} />
                  )}
                </View>
                <Text fontSize={11} fontWeight={isActive ? '700' : '400'} color={isActive ? '$color' : '$muted'}>
                  {STEP_LABELS[s]}
                </Text>
              </YStack>
            </React.Fragment>
          )
        })}
      </XStack>

      <ScrollView style={{ flex: 1 }}>
        {/* STEP: PHOTOS */}
        {step === 'photos' && (
          <YStack padding={20} gap={16} position="relative">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize={18} fontWeight="700" color="$color">拍攝送貨照片</Text>
                <Text fontSize={13} fontWeight="400" color="$muted" marginTop={4}>至少需要 1 張照片</Text>
              </YStack>
              {photos.length > 0 && (
                <View style={{ backgroundColor: theme.primary?.val, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 }}>
                  <Text fontSize={12} fontWeight="700" color="white">已拍 {photos.length} 張</Text>
                </View>
              )}
            </XStack>

            {permission?.granted ? (
              <YStack height={340} borderRadius={16} overflow="hidden" backgroundColor="#000">
                <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
                <Pressable
                  style={{
                    position: 'absolute',
                    bottom: 24,
                    alignSelf: 'center',
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: theme.primary?.val,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={takePhoto}
                  accessibilityLabel="拍照"
                  accessibilityRole="button"
                >
                  <Camera size={32} color="white" />
                </Pressable>
              </YStack>
            ) : (
              <YStack padding={32} alignItems="center" gap={8} backgroundColor="$backgroundStrong" borderRadius={16}>
                <Camera size={32} color={theme.muted?.val} />
                <Text color="$muted" textAlign="center" fontSize={14}>需要相機權限才能拍攝送貨照片</Text>
              </YStack>
            )}

            {previewUri && (
              <YStack
                position="absolute"
                top={0} left={0} right={0} bottom={0}
                backgroundColor="rgba(0,0,0,0.9)"
                justifyContent="center"
                alignItems="center"
                zIndex={100}
                padding={20}
                gap={20}
              >
                <Text fontSize={16} fontWeight="700" color="white">確認照片</Text>
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: '100%', height: 400, borderRadius: 12 }}
                  resizeMode="contain"
                />
                <XStack gap={16} width="100%">
                  <Pressable
                    onPress={retakePhoto}
                    style={{
                      flex: 1, minHeight: 52, borderRadius: 9999,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <Text color="white" fontWeight="600" fontSize={16}>重拍</Text>
                  </Pressable>
                  <Pressable
                    onPress={acceptPhoto}
                    style={{
                      flex: 1, minHeight: 52, borderRadius: 9999,
                      backgroundColor: '#22C55E',
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <Text color="white" fontWeight="700" fontSize={16}>使用此照片</Text>
                  </Pressable>
                </XStack>
              </YStack>
            )}

            {photos.length > 0 && (
              <XStack gap={8} flexWrap="wrap">
                {photos.map((uri, i) => (
                  <PhotoThumbnail
                    key={i}
                    uri={uri}
                    onDelete={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </XStack>
            )}
          </YStack>
        )}

        {/* STEP: SIGNATURE */}
        {step === 'signature' && (
          <YStack padding={20} gap={16}>
            <YStack>
              <Text fontSize={18} fontWeight="700" color="$color">客戶簽名（選填）</Text>
              <Text fontSize={13} fontWeight="400" color="$muted" marginTop={4}>請收件人在下方簽名</Text>
            </YStack>
            <YStack height={220} borderRadius={12} borderWidth={2} borderStyle="dashed" borderColor={signatureUri ? '$primary' : '$borderColor'} overflow="hidden" backgroundColor="$backgroundStrong">
              <SignatureScreen
                ref={signatureRef}
                onOK={(signature: string) => setSignatureUri(signature)}
                webStyle={`.m-signature-pad { box-shadow: none; border: none; background-color: ${theme.backgroundStrong?.val}; } .m-signature-pad--body { border: none; background-color: ${theme.backgroundStrong?.val}; }`}
              />
              {!signatureUri && (
                <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                  <Text fontSize={14} color="$muted">請在此簽名</Text>
                </View>
              )}
            </YStack>
            <XStack justifyContent="space-between" alignItems="center">
              {signatureUri ? (
                <Text fontSize={12} color="$success" fontWeight="600">簽名已擷取</Text>
              ) : (
                <Text fontSize={12} color="$muted">請在上方簽名</Text>
              )}
              <Pressable
                onPress={() => {
                  signatureRef.current?.clearSignature()
                  setSignatureUri(null)
                }}
                accessibilityLabel="清除簽名"
                style={{ padding: 8 }}
              >
                <Text fontSize={13} color="$danger" fontWeight="600">清除</Text>
              </Pressable>
            </XStack>
          </YStack>
        )}

        {/* STEP: CASH */}
        {step === 'cash' && (
          <YStack padding={20} gap={20}>
            <YStack alignItems="center" gap={4} paddingVertical={16}>
              <Text fontSize={12} fontWeight="500" color="$muted" textTransform="uppercase" letterSpacing={1}>代收金額</Text>
              <Text fontSize={32} fontWeight="800" color="$color" letterSpacing={-1}>
                ${job?.expected_collection_amount?.toLocaleString() || '0'}
              </Text>
            </YStack>

            <YStack gap={8}>
              <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>實收金額 (HKD)</Text>
              <Input
                value={cashAmount}
                onChangeText={setCashAmount}
                keyboardType="numeric"
                size="$5"
                borderRadius={12}
                fontSize={20}
                fontWeight="700"
                borderWidth={1}
                borderColor="$borderColor"
                backgroundColor="$backgroundStrong"
                color="$color"
              />
              {job?.expected_collection_amount && parseFloat(cashAmount) !== job.expected_collection_amount && cashAmount.length > 0 && (
                <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                  <YStack flex={1}>
                    <Text fontSize={12} fontWeight="600" color="#FBBF24">金額與預期不符</Text>
                    <Text fontSize={11} color="$warning" marginTop={2}>
                      預期: ${job.expected_collection_amount.toLocaleString()} · 輸入: ${parseFloat(cashAmount).toLocaleString()}
                    </Text>
                  </YStack>
                </View>
              )}
            </YStack>

            <YStack gap={8}>
              <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>付款方式</Text>
              <XStack gap={8}>
                {(['cash', 'fps', 'cheque'] as const).map((method) => {
                  const labels = { cash: '現金', fps: 'FPS', cheque: '支票' }
                  const isSelected = cashMethod === method
                  return (
                    <Pressable
                      key={method}
                      onPress={() => setCashMethod(method)}
                      style={{
                        flex: 1, paddingVertical: 14, borderRadius: 9999, alignItems: 'center',
                        backgroundColor: isSelected ? theme.primary?.val : 'transparent',
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: theme.borderColor?.val,
                      }}
                    >
                      <Text fontSize={14} fontWeight="600" color={isSelected ? 'white' : '$color'}>{labels[method]}</Text>
                    </Pressable>
                  )
                })}
              </XStack>
            </YStack>

            <YStack gap={8}>
              <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>參考編號 / 備註</Text>
              <Input
                value={cashRef}
                onChangeText={setCashRef}
                placeholder="收據編號、備註..."
                placeholderTextColor={theme.muted?.val as any}
                size="$5"
                borderRadius={12}
                borderWidth={1}
                borderColor="$borderColor"
                backgroundColor="$backgroundStrong"
                color="$color"
              />
            </YStack>

            {job?.collection_required && (!cashAmount || cashAmount === '0' || isNaN(parseFloat(cashAmount))) && (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={16} color="#EF4444" />
                <Text fontSize={12} fontWeight="600" color="$danger">收款金額為 $0 或空白 — 請確認</Text>
              </View>
            )}

            <YStack gap={8}>
              <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>收據照片（選填）</Text>
              <Pressable
                onPress={async () => {
                  try {
                    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
                    if (result?.uri) setCashPhotoUri(result.uri)
                  } catch {}
                }}
                style={{
                  height: 48, borderRadius: 12, borderWidth: 2,
                  borderColor: theme.borderColor?.val,
                  borderStyle: 'dashed',
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
                }}
              >
                <Camera size={18} color={theme.muted?.val} />
                <Text fontSize={14} color="$muted">{cashPhotoUri ? '照片已拍攝 ✓' : '點擊拍攝收據'}</Text>
              </Pressable>
            </YStack>
          </YStack>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && (
          <YStack padding={20} gap={16}>
            <Text fontSize={18} fontWeight="700" color="$color">確認送貨</Text>

            <YStack gap={12} padding={16} backgroundColor="$backgroundStrong" borderRadius={12}>
              <XStack alignItems="center" gap={10}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <Check size={14} color="#22C55E" />
                </View>
                <Text fontSize={14} color="$color">已拍 {photos.length} 張照片</Text>
              </XStack>
              {photos.length > 0 && (
                <XStack gap={6} flexWrap="wrap" marginLeft={34}>
                  {photos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                  ))}
                </XStack>
              )}

              <XStack alignItems="center" gap={10}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: signatureUri ? 'rgba(34,197,94,0.15)' : 'rgba(92,94,102,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  {signatureUri ? <Check size={14} color="#22C55E" /> : <PenTool size={12} color={theme.muted?.val} />}
                </View>
                <Text fontSize={14} color="$color">{signatureUri ? '已獲得簽名' : '無簽名'}</Text>
              </XStack>
              {signatureUri && (
                <Image source={{ uri: signatureUri }} style={{ width: 120, height: 60, borderRadius: 8, backgroundColor: '#fff', marginLeft: 34 }} resizeMode="contain" />
              )}

              {job?.collection_required && (
                <XStack alignItems="center" gap={10}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                    <Check size={14} color="#22C55E" />
                  </View>
                  <Text fontSize={14} color="$color">
                    已記錄收款 · {cashMethod === 'cash' ? '現金' : cashMethod === 'fps' ? 'FPS' : '支票'} ${parseFloat(cashAmount || '0').toLocaleString()}
                  </Text>
                </XStack>
              )}

              {job?.collection_required && (!cashAmount || cashAmount === '0' || isNaN(parseFloat(cashAmount))) && (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <AlertTriangle size={16} color="#EF4444" />
                  <Text fontSize={12} fontWeight="600" color="$danger">收款金額為 $0 或空白 — 請確認</Text>
                </View>
              )}
            </YStack>

            {/* Items - editable quantities */}
            {job?.items && job.items.length > 0 && (
              <YStack gap={8}>
                <Text fontSize={14} fontWeight="700" color="$color">已送物品</Text>
                {job.items.map((item) => (
                  <XStack key={item.move_id || item.product_name} justifyContent="space-between" alignItems="center" padding={12} backgroundColor="$backgroundStrong" borderRadius={12}>
                    <Text fontSize={12} flex={1} numberOfLines={2} color="$color">{item.product_name}</Text>
                    <XStack alignItems="center" gap={8}>
                      <Pressable
                        onPress={() => {
                          if (!item.move_id) return
                          setItemQuantities((prev) => ({
                            ...prev,
                            [item.move_id!]: Math.max(0, (prev[item.move_id!] || 0) - 1),
                          }))
                        }}
                        style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: 'rgba(239,68,68,0.15)', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text fontSize={16} fontWeight="700" color="$danger">{'\u2212'}</Text>
                      </Pressable>
                      <Text fontSize={16} fontWeight="700" color="$color" style={{ minWidth: 24, textAlign: 'center' }}>
                        {item.move_id ? (itemQuantities[item.move_id] ?? item.quantity) : item.quantity}
                      </Text>
                      <Text fontSize={11} color="$muted">/ {item.quantity}</Text>
                      <Pressable
                        onPress={() => {
                          if (!item.move_id) return
                          setItemQuantities((prev) => ({
                            ...prev,
                            [item.move_id!]: Math.min(item.quantity, (prev[item.move_id!] || 0) + 1),
                          }))
                        }}
                        style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text fontSize={16} fontWeight="700" color="$success">+</Text>
                      </Pressable>
                    </XStack>
                  </XStack>
                ))}
                {job.items.some((item) => item.move_id && (itemQuantities[item.move_id] ?? item.quantity) < item.quantity) && (
                  <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 12 }}>
                    <Text fontSize={12} fontWeight="600" color="#FBBF24">
                      部分送貨 — 剩餘物品將建立補單
                    </Text>
                  </View>
                )}
              </YStack>
            )}
          </YStack>
        )}
      </ScrollView>

      {/* Bottom nav buttons */}
      <YStack paddingHorizontal={20} paddingTop={12} paddingBottom={24} gap={8} backgroundColor="$background" borderTopWidth={1} borderTopColor="$borderColor">
        {step === 'confirm' ? (
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              minHeight: 52, borderRadius: 9999, backgroundColor: '#22C55E',
              justifyContent: 'center', alignItems: 'center',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? <Spinner color="white" /> : <Text color="white" fontWeight="700" fontSize={16}>提交</Text>}
          </Pressable>
        ) : (
          <XStack gap={12}>
            {stepIndex > 0 && (
              <Pressable
                onPress={prevStep}
                style={{
                  flex: 1, minHeight: 52, borderRadius: 9999,
                  borderWidth: 1, borderColor: theme.borderColor?.val,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text color="$colorSubtle" fontWeight="600" fontSize={16}>上一步</Text>
              </Pressable>
            )}
            <Pressable
              onPress={nextStep}
              disabled={!canProceed()}
              style={{
                flex: 1, minHeight: 52, borderRadius: 9999,
                backgroundColor: theme.primary?.val,
                justifyContent: 'center', alignItems: 'center',
                opacity: canProceed() ? 1 : 0.4,
              }}
            >
              <Text color="white" fontWeight="700" fontSize={16}>
                {step === 'signature' ? '下一步（或跳過）' : '下一步'}
              </Text>
            </Pressable>
          </XStack>
        )}
      </YStack>
    </YStack>
    </SafeAreaView>
  )
}
