import React, { useState, useRef, useEffect } from 'react'
import { ScrollView, Alert, StyleSheet, Pressable, Image } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Camera, PenTool, Banknote, AlertTriangle } from 'lucide-react-native'
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

export default function CompleteDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job } = useJob(jobId)
  const router = useRouter()
  const addAction = useQueueStore((s) => s.addAction)

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

  // Load persisted completion data on mount
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

  // Persist completion data on change
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

    // Check if partial delivery
    const isPartial = job?.items?.some((item) =>
      item.move_id && (itemQuantities[item.move_id] ?? item.quantity) < item.quantity
    )

    // Generate action IDs up front
    const podActionId = generateActionId()
    const cashActionId = job?.collection_required ? generateActionId() : undefined
    const statusActionId = generateActionId()
    const partialActionId = isPartial ? generateActionId() : undefined

    // Queue ALL actions first so they persist even if API calls fail
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

    // Now attempt API calls — on success remove from queue, on failure queued actions remain for sync retry
    const removeAction = useQueueStore.getState().removeAction

    try {
      // Upload photos in parallel (3 concurrent)
      const uploadIds = await uploadPhotoBatch(photos, 3)

      // Upload signature
      let sigUploadId: string | undefined
      if (signatureUri) {
        try {
          const result = await uploadFile(signatureUri, 'signature')
          sigUploadId = result.upload_id
        } catch {}
      }

      // Submit POD
      await submitPod(jobId, {
        action_id: podActionId,
        photo_upload_ids: uploadIds,
        signature_upload_id: sigUploadId,
        timestamp,
      })
      removeAction(podActionId)

      // Submit cash if required
      if (job?.collection_required && cashActionId) {
        // Upload cash receipt photo if captured
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

      // Submit partial delivery if needed
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

      // Mark delivered
      await updateStatus(jobId, {
        action_id: statusActionId,
        status: 'delivered',
        timestamp,
      })
      removeAction(statusActionId)

      await AsyncStorage.removeItem(storageKey)
      await triggerHaptic('success')
      showToast('Delivery completed!', 'success')
      router.dismiss()
    } catch (e) {
      await AsyncStorage.removeItem(storageKey)
      showToast('Saved locally, will sync when connected', 'info')
      router.dismiss()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: 'Complete Delivery', presentation: 'modal' }} />

      {/* Step indicator */}
      <XStack padding="$4" justifyContent="center" gap="$2">
        {steps.map((s, i) => (
          <YStack
            key={s}
            width={i === stepIndex ? 24 : 8}
            height={8}
            borderRadius={4}
            backgroundColor={i <= stepIndex ? '$primary' : '#e5e7eb'}
          />
        ))}
      </XStack>

      <ScrollView style={{ flex: 1 }}>
        {/* STEP: PHOTOS */}
        {step === 'photos' && (
          <YStack padding="$4" gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize={18} fontWeight="700">Take Delivery Photos</Text>
                <Text fontSize={13} color="$colorSubtle">At least 1 photo required</Text>
              </YStack>
              {photos.length > 0 && (
                <XStack backgroundColor="$primary" paddingHorizontal={12} paddingVertical={4} borderRadius={12}>
                  <Text fontSize={13} fontWeight="700" color="white">{photos.length} taken</Text>
                </XStack>
              )}
            </XStack>

            {permission?.granted ? (
              <YStack height={340} borderRadius={14} overflow="hidden" backgroundColor="#000">
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
                    borderColor: 'rgba(255,255,255,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={takePhoto}
                  accessibilityLabel="Take photo"
                  accessibilityRole="button"
                >
                  <Camera size={28} color="#2563eb" />
                </Pressable>
              </YStack>
            ) : (
              <YStack padding="$6" alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderRadius={14}>
                <Camera size={32} color="#6b7280" />
                <Text color="$colorSubtle" textAlign="center">Camera permission is required to take delivery photos</Text>
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
            <Text fontSize={18} fontWeight="700">Signature (Optional)</Text>
            <Text fontSize={13} color="$colorSubtle">Ask the recipient to sign in the box below</Text>
            <YStack height={220} borderRadius={14} borderWidth={2} borderColor={signatureUri ? '$primary' : '$borderColor'} overflow="hidden">
              <SignatureScreen
                ref={signatureRef}
                onOK={(signature: string) => setSignatureUri(signature)}
                webStyle={`.m-signature-pad { box-shadow: none; border: none; } .m-signature-pad--body { border: none; }`}
              />
            </YStack>
            <XStack justifyContent="space-between" alignItems="center">
              {signatureUri ? (
                <Text fontSize={12} color="$primary" fontWeight="600">Signature captured</Text>
              ) : (
                <Text fontSize={12} color="$colorSubtle">Draw signature above</Text>
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
                <Text fontSize={12} color="$danger" fontWeight="600">Clear</Text>
              </Button>
            </XStack>
          </YStack>
        )}

        {/* STEP: CASH */}
        {step === 'cash' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={18} fontWeight="700">Cash Collection</Text>
            <YStack gap="$2">
              <Text fontSize={11} color="$colorSubtle">Amount (HKD)</Text>
              <Input
                value={cashAmount}
                onChangeText={setCashAmount}
                keyboardType="numeric"
                size="$5"
                borderRadius={14}
                fontSize={20}
                fontWeight="700"
              />
              {job?.expected_collection_amount && parseFloat(cashAmount) !== job.expected_collection_amount && cashAmount.length > 0 && (
                <XStack backgroundColor="#fefce8" borderRadius={10} padding={12} gap={8} alignItems="flex-start" borderWidth={1} borderColor="#fef3c7">
                  <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                  <YStack flex={1}>
                    <Text fontSize={12} fontWeight="600" color="#92400e">
                      Amount differs from expected
                    </Text>
                    <Text fontSize={11} color="#a16207" marginTop={2}>
                      Expected: ${job.expected_collection_amount.toLocaleString()} · Entered: ${parseFloat(cashAmount).toLocaleString()}
                    </Text>
                  </YStack>
                </XStack>
              )}
            </YStack>
            <YStack gap="$2">
              <Text fontSize={11} color="$colorSubtle">Method</Text>
              <XStack gap="$2">
                <Button
                  flex={1} size="$5" borderRadius={14}
                  backgroundColor={cashMethod === 'cash' ? '$primary' : '$backgroundStrong'}
                  onPress={() => setCashMethod('cash')}
                >
                  <Text color={cashMethod === 'cash' ? 'white' : '$color'} fontWeight="600">Cash</Text>
                </Button>
                <Button
                  flex={1} size="$5" borderRadius={14}
                  backgroundColor={cashMethod === 'cheque' ? '$primary' : '$backgroundStrong'}
                  onPress={() => setCashMethod('cheque')}
                >
                  <Text color={cashMethod === 'cheque' ? 'white' : '$color'} fontWeight="600">Cheque</Text>
                </Button>
              </XStack>
            </YStack>
            <YStack gap="$2">
              <Text fontSize={11} color="$colorSubtle">Reference / Note</Text>
              <Input
                value={cashRef}
                onChangeText={setCashRef}
                placeholder="Receipt number, notes..."
                size="$5"
                borderRadius={14}
              />
            </YStack>
            {job?.collection_required && (!cashAmount || cashAmount === '0' || isNaN(parseFloat(cashAmount))) && (
              <XStack backgroundColor="#fef2f2" borderRadius={10} padding={12} gap={8} alignItems="center" borderWidth={1} borderColor="#fecaca">
                <AlertTriangle size={16} color="#dc2626" />
                <Text fontSize={12} fontWeight="600" color="#dc2626">Cash amount is $0 or empty — please verify</Text>
              </XStack>
            )}
            <YStack gap="$1" marginTop="$1">
              <Text fontSize={11} fontWeight="600" color="$colorSubtle" textTransform="uppercase" letterSpacing={1}>Receipt Photo (Optional)</Text>
              <Pressable
                onPress={async () => {
                  try {
                    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
                    if (result?.uri) setCashPhotoUri(result.uri)
                  } catch {}
                }}
                style={{
                  height: 48, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed',
                  justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
                }}
              >
                <Camera size={18} color="#94a3b8" />
                <Text fontSize={13} color="#94a3b8">{cashPhotoUri ? 'Photo taken \u2713' : 'Tap to photograph receipt'}</Text>
              </Pressable>
            </YStack>
          </YStack>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={18} fontWeight="700">Confirm Delivery</Text>
            <YStack gap="$3" padding="$3" backgroundColor="$backgroundStrong" borderRadius={14}>
              <XStack alignItems="center" gap={8}>
                <Camera size={16} color="#2563eb" />
                <Text fontSize={13}>{photos.length} photo(s)</Text>
              </XStack>
              {photos.length > 0 && (
                <XStack gap={6} flexWrap="wrap">
                  {photos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                  ))}
                </XStack>
              )}
              <XStack alignItems="center" gap={8}>
                <PenTool size={16} color="#2563eb" />
                <Text fontSize={13}>{signatureUri ? 'Signature captured' : 'No signature'}</Text>
              </XStack>
              {signatureUri && (
                <Image source={{ uri: signatureUri }} style={{ width: 120, height: 60, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
              )}
              {job?.collection_required && (
                <XStack alignItems="center" gap={8}>
                  <Banknote size={16} color="#2563eb" />
                  <Text fontSize={13}>{cashMethod} ${cashAmount}</Text>
                </XStack>
              )}
              {job?.collection_required && (!cashAmount || cashAmount === '0' || isNaN(parseFloat(cashAmount))) && (
                <XStack backgroundColor="#fef2f2" borderRadius={10} padding={12} gap={8} alignItems="center" borderWidth={1} borderColor="#fecaca">
                  <AlertTriangle size={16} color="#dc2626" />
                  <Text fontSize={12} fontWeight="600" color="#dc2626">Cash amount is $0 or empty — please verify</Text>
                </XStack>
              )}
            </YStack>

            {/* Items - editable quantities */}
            {job?.items && job.items.length > 0 && (
              <YStack gap="$2">
                <Text fontSize={14} fontWeight="700">Items Delivered</Text>
                {job.items.map((item) => (
                  <XStack key={item.move_id || item.product_name} justifyContent="space-between" alignItems="center" padding="$2" backgroundColor="$backgroundStrong" borderRadius={10}>
                    <Text fontSize={12} flex={1} numberOfLines={2}>{item.product_name}</Text>
                    <XStack alignItems="center" gap={8}>
                      <Pressable
                        onPress={() => {
                          if (!item.move_id) return
                          setItemQuantities((prev) => ({
                            ...prev,
                            [item.move_id!]: Math.max(0, (prev[item.move_id!] || 0) - 1),
                          }))
                        }}
                        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text fontSize={16} fontWeight="700" color="#dc2626">{'\u2212'}</Text>
                      </Pressable>
                      <Text fontSize={16} fontWeight="700" style={{ minWidth: 24, textAlign: 'center' }}>
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
                        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text fontSize={16} fontWeight="700" color="#16a34a">+</Text>
                      </Pressable>
                    </XStack>
                  </XStack>
                ))}
                {/* Partial delivery warning */}
                {job.items.some((item) => item.move_id && (itemQuantities[item.move_id] ?? item.quantity) < item.quantity) && (
                  <XStack backgroundColor="#fefce8" borderRadius={10} padding={12} gap={8} alignItems="flex-start" borderWidth={1} borderColor="#fef3c7">
                    <Text fontSize={12} fontWeight="600" color="#92400e">
                      Partial delivery — a backorder will be created for remaining items
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
            size="$5" backgroundColor="#F97316" borderRadius={14}
            onPress={handleSubmit} disabled={submitting} minHeight={56}
            pressStyle={{ opacity: 0.7 }}
          >
            {submitting ? <Spinner color="white" /> : <Text color="white" fontWeight="700" fontSize={16}>Submit & Complete</Text>}
          </Button>
        ) : (
          <Button
            size="$5" backgroundColor="$primary" borderRadius={14}
            onPress={nextStep} disabled={step === 'photos' && photos.length === 0} minHeight={56}
            pressStyle={{ opacity: 0.7 }}
          >
            <Text color="white" fontWeight="700" fontSize={16}>{step === 'signature' ? 'Next (or Skip)' : 'Next'}</Text>
          </Button>
        )}
        {stepIndex > 0 && (
          <Button size="$4" chromeless onPress={prevStep}>
            <Text color="$colorSubtle">Back</Text>
          </Button>
        )}
      </YStack>
    </YStack>
    </SafeAreaView>
  )
}
