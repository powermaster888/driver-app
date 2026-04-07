import React, { useState, useRef, useEffect } from 'react'
import { ScrollView, Alert, StyleSheet, Pressable, Image, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Camera, PenTool, Banknote, AlertTriangle, Check } from 'lucide-react-native'
import SignatureScreen from 'react-native-signature-canvas'
import { useJob } from '../../../src/api/jobs'
import { PhotoThumbnail } from '../../../src/components/PhotoThumbnail'
import { useQueueStore } from '../../../src/store/queue'
import { useSettingsStore } from '../../../src/store/settings'
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
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

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

  const storageKey = `completion_${jobId}`

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
    if (result?.uri) setPhotos((prev) => [...prev, result.uri])
  }

  const steps: Step[] = ['photos', 'signature', ...(job?.collection_required ? ['cash' as Step] : []), 'confirm']
  const stepIndex = steps.indexOf(step)
  const nextStep = () => setStep(steps[stepIndex + 1])
  const prevStep = () => stepIndex > 0 && setStep(steps[stepIndex - 1])

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
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: 'Complete Delivery', presentation: 'modal' }} />

      {/* Step indicator — numbered circles */}
      <XStack padding="$4" justifyContent="center" alignItems="center" gap="$1">
        {steps.map((s, i) => {
          const isActive = i === stepIndex
          const isCompleted = i < stepIndex
          return (
            <React.Fragment key={s}>
              {i > 0 && (
                <View style={{ width: 24, height: 2, backgroundColor: isCompleted ? (isDark ? '#2563EB' : '#2563EB') : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0') }} />
              )}
              <YStack alignItems="center" gap={4}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: isActive ? (isDark ? '#2563EB' : '#2563EB') : isCompleted ? (isDark ? '#2563EB' : '#2563EB') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {isCompleted ? (
                    <Check size={14} color="white" />
                  ) : (
                    <Text fontSize={12} fontWeight="700" color={isActive ? 'white' : (isDark ? '#62666D' : '#8A8F98')}>{i + 1}</Text>
                  )}
                </View>
                <Text fontSize={10} fontWeight={isActive ? '700' : '500'} color={isActive ? '$color' : '#62666D'}>{STEP_LABELS[s]}</Text>
              </YStack>
            </React.Fragment>
          )
        })}
      </XStack>

      <ScrollView style={{ flex: 1 }}>
        {/* STEP: PHOTOS */}
        {step === 'photos' && (
          <YStack padding="$4" gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize={17} fontWeight="700" color="$color">拍攝送貨照片</Text>
                <Text fontSize={14} fontWeight="400" color="$colorSubtle">至少需要 1 張照片</Text>
              </YStack>
              {photos.length > 0 && (
                <XStack backgroundColor="$primary" paddingHorizontal={12} paddingVertical={4} borderRadius={9999}>
                  <Text fontSize={13} fontWeight="700" color="white">已拍 {photos.length} 張</Text>
                </XStack>
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
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: 'white',
                    borderWidth: 4,
                    borderColor: 'rgba(255,255,255,0.3)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={takePhoto}
                  accessibilityLabel="Take photo"
                  accessibilityRole="button"
                >
                  <Camera size={28} color="#2563EB" />
                </Pressable>
              </YStack>
            ) : (
              <YStack padding="$6" alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderRadius={16}>
                <Camera size={32} color="$colorSubtle" />
                <Text color="$colorSubtle" textAlign="center">需要相機權限才能拍攝送貨照片</Text>
              </YStack>
            )}

            {photos.length > 0 && (
              <XStack gap="$2" flexWrap="wrap">
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
          <YStack padding="$4" gap="$3">
            <Text fontSize={17} fontWeight="700" color="$color">簽名（選填）</Text>
            <Text fontSize={14} fontWeight="400" color="$colorSubtle">請收件人在下方簽名</Text>
            <YStack height={220} borderRadius={16} borderWidth={1} borderColor={signatureUri ? '$primary' : '$borderColor'} overflow="hidden">
              <SignatureScreen
                ref={signatureRef}
                onOK={(signature: string) => setSignatureUri(signature)}
                webStyle={`.m-signature-pad { box-shadow: none; border: none; } .m-signature-pad--body { border: none; }`}
              />
            </YStack>
            <XStack justifyContent="space-between" alignItems="center">
              {signatureUri ? (
                <Text fontSize={12} color="$primary" fontWeight="600">簽名已擷取</Text>
              ) : (
                <Text fontSize={12} color="$colorSubtle">請在上方簽名</Text>
              )}
              <Button
                size="$3"
                chromeless
                onPress={() => {
                  signatureRef.current?.clearSignature()
                  setSignatureUri(null)
                }}
                accessibilityLabel="Clear signature"
              >
                <Text fontSize={12} color="$danger" fontWeight="600">清除</Text>
              </Button>
            </XStack>
          </YStack>
        )}

        {/* STEP: CASH */}
        {step === 'cash' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={17} fontWeight="700" color="$color">收款</Text>
            <YStack gap="$2">
              <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>金額 (HKD)</Text>
              <Input
                value={cashAmount}
                onChangeText={setCashAmount}
                keyboardType="numeric"
                size="$5"
                borderRadius={12}
                fontSize={24}
                fontWeight="700"
              />
              {job?.expected_collection_amount && parseFloat(cashAmount) !== job.expected_collection_amount && cashAmount.length > 0 && (
                <XStack backgroundColor={isDark ? 'rgba(245,158,11,0.1)' : '#fefce8'} borderRadius={10} padding="$3" gap="$2" alignItems="flex-start" borderWidth={1} borderColor={isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7'}>
                  <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                  <YStack flex={1}>
                    <Text fontSize={12} fontWeight="600" color={isDark ? '#FBBF24' : '#92400e'}>
                      金額與預期不符
                    </Text>
                    <Text fontSize={11} color={isDark ? '#f59e0b' : '#a16207'} marginTop={2}>
                      預期: ${job.expected_collection_amount.toLocaleString()} · 輸入: ${parseFloat(cashAmount).toLocaleString()}
                    </Text>
                  </YStack>
                </XStack>
              )}
            </YStack>
            <YStack gap="$2">
              <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>付款方式</Text>
              <XStack gap="$2">
                <Button
                  flex={1} size="$5" borderRadius={9999}
                  backgroundColor={cashMethod === 'cash' ? '$primary' : '$backgroundStrong'}
                  onPress={() => setCashMethod('cash')}
                >
                  <Text color={cashMethod === 'cash' ? 'white' : '$color'} fontWeight="600">現金</Text>
                </Button>
                <Button
                  flex={1} size="$5" borderRadius={9999}
                  backgroundColor={cashMethod === 'cheque' ? '$primary' : '$backgroundStrong'}
                  onPress={() => setCashMethod('cheque')}
                >
                  <Text color={cashMethod === 'cheque' ? 'white' : '$color'} fontWeight="600">支票</Text>
                </Button>
              </XStack>
            </YStack>
            <YStack gap="$2">
              <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>參考編號 / 備註</Text>
              <Input
                value={cashRef}
                onChangeText={setCashRef}
                placeholder="收據編號、備註..."
                size="$5"
                borderRadius={12}
              />
            </YStack>
            {job?.collection_required && (!cashAmount || cashAmount === '0' || isNaN(parseFloat(cashAmount))) && (
              <XStack backgroundColor={isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2'} borderRadius={10} padding="$3" gap="$2" alignItems="center" borderWidth={1} borderColor={isDark ? 'rgba(220,38,38,0.2)' : '#fecaca'}>
                <AlertTriangle size={16} color="#dc2626" />
                <Text fontSize={12} fontWeight="600" color="#dc2626">收款金額為 $0 或空白 — 請確認</Text>
              </XStack>
            )}
            <YStack gap="$1" marginTop="$1">
              <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>收據照片（選填）</Text>
              <Pressable
                onPress={async () => {
                  try {
                    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
                    if (result?.uri) setCashPhotoUri(result.uri)
                  } catch {}
                }}
                style={{
                  height: 48, borderRadius: 12, borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                  borderStyle: 'dashed',
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
                }}
              >
                <Camera size={18} color="#8A8F98" />
                <Text fontSize={14} color="$colorSubtle">{cashPhotoUri ? '照片已拍攝 \u2713' : '點擊拍攝收據'}</Text>
              </Pressable>
            </YStack>
          </YStack>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={17} fontWeight="700" color="$color">確認送貨</Text>
            <YStack gap="$3" padding="$4" backgroundColor="$backgroundStrong" borderRadius={16} borderWidth={1} borderColor="$borderColor">
              <XStack alignItems="center" gap="$2">
                <Camera size={16} color={isDark ? '#2563EB' : '#2563EB'} />
                <Text fontSize={14} color="$color">{photos.length} 張照片</Text>
              </XStack>
              {photos.length > 0 && (
                <XStack gap={6} flexWrap="wrap">
                  {photos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={{ width: 60, height: 60, borderRadius: 10 }} />
                  ))}
                </XStack>
              )}
              <XStack alignItems="center" gap="$2">
                <PenTool size={16} color={isDark ? '#2563EB' : '#2563EB'} />
                <Text fontSize={14} color="$color">{signatureUri ? '簽名已擷取' : '無簽名'}</Text>
              </XStack>
              {signatureUri && (
                <Image source={{ uri: signatureUri }} style={{ width: 120, height: 60, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
              )}
              {job?.collection_required && (
                <XStack alignItems="center" gap="$2">
                  <Banknote size={16} color={isDark ? '#2563EB' : '#2563EB'} />
                  <Text fontSize={14} fontWeight="600" color="$color">{cashMethod} ${cashAmount}</Text>
                </XStack>
              )}
              {job?.collection_required && (!cashAmount || cashAmount === '0' || isNaN(parseFloat(cashAmount))) && (
                <XStack backgroundColor={isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2'} borderRadius={10} padding="$3" gap="$2" alignItems="center" borderWidth={1} borderColor={isDark ? 'rgba(220,38,38,0.2)' : '#fecaca'}>
                  <AlertTriangle size={16} color="#dc2626" />
                  <Text fontSize={12} fontWeight="600" color="#dc2626">收款金額為 $0 或空白 — 請確認</Text>
                </XStack>
              )}
            </YStack>

            {/* Items - editable quantities */}
            {job?.items && job.items.length > 0 && (
              <YStack gap="$2">
                <Text fontSize={14} fontWeight="700" color="$color">已送物品</Text>
                {job.items.map((item) => (
                  <XStack key={item.move_id || item.product_name} justifyContent="space-between" alignItems="center" padding="$2" backgroundColor="$backgroundStrong" borderRadius={10} borderWidth={1} borderColor="$borderColor">
                    <Text fontSize={12} flex={1} numberOfLines={2} color="$color">{item.product_name}</Text>
                    <XStack alignItems="center" gap="$2">
                      <Pressable
                        onPress={() => {
                          if (!item.move_id) return
                          setItemQuantities((prev) => ({
                            ...prev,
                            [item.move_id!]: Math.max(0, (prev[item.move_id!] || 0) - 1),
                          }))
                        }}
                        style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text fontSize={16} fontWeight="700" color="#dc2626">{'\u2212'}</Text>
                      </Pressable>
                      <Text fontSize={16} fontWeight="700" color="$color" style={{ minWidth: 24, textAlign: 'center' }}>
                        {item.move_id ? (itemQuantities[item.move_id] ?? item.quantity) : item.quantity}
                      </Text>
                      <Text fontSize={11} color="$colorSubtle">/ {item.quantity}</Text>
                      <Pressable
                        onPress={() => {
                          if (!item.move_id) return
                          setItemQuantities((prev) => ({
                            ...prev,
                            [item.move_id!]: Math.min(item.quantity, (prev[item.move_id!] || 0) + 1),
                          }))
                        }}
                        style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text fontSize={16} fontWeight="700" color="#16a34a">+</Text>
                      </Pressable>
                    </XStack>
                  </XStack>
                ))}
                {job.items.some((item) => item.move_id && (itemQuantities[item.move_id] ?? item.quantity) < item.quantity) && (
                  <XStack backgroundColor={isDark ? 'rgba(245,158,11,0.1)' : '#fefce8'} borderRadius={10} padding="$3" gap="$2" alignItems="flex-start" borderWidth={1} borderColor={isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7'}>
                    <Text fontSize={12} fontWeight="600" color={isDark ? '#FBBF24' : '#92400e'}>
                      部分送貨 — 剩餘物品將建立補單
                    </Text>
                  </XStack>
                )}
              </YStack>
            )}
          </YStack>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <YStack padding="$4" gap="$2" backgroundColor="$backgroundStrong" borderTopWidth={1} borderTopColor="$borderColor">
        {step === 'confirm' ? (
          <Button
            size="$5" backgroundColor="#F97316" borderRadius={9999}
            onPress={handleSubmit} disabled={submitting} minHeight={52}
            pressStyle={{ opacity: 0.85 }}
          >
            {submitting ? <Spinner color="white" /> : <Text color="white" fontWeight="700" fontSize={16}>提交並完成</Text>}
          </Button>
        ) : (
          <Button
            size="$5" backgroundColor="$primary" borderRadius={9999}
            onPress={nextStep} disabled={step === 'photos' && photos.length === 0} minHeight={52}
            pressStyle={{ opacity: 0.85 }}
          >
            <Text color="white" fontWeight="700" fontSize={16}>{step === 'signature' ? '下一步（或跳過）' : '下一步'}</Text>
          </Button>
        )}
        {stepIndex > 0 && (
          <Button size="$4" chromeless onPress={prevStep}>
            <Text color="$colorSubtle" fontWeight="500">上一步</Text>
          </Button>
        )}
      </YStack>
    </YStack>
    </SafeAreaView>
  )
}
